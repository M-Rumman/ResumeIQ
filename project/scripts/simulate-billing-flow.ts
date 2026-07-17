/**
 * Local billing flow simulation — verifies persistence when profile row is missing.
 * Usage: npx tsx scripts/simulate-billing-flow.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL (or SUPABASE_URL) in env.
 */
import { createClient } from '@supabase/supabase-js';
import {
  activateProSubscription,
  deactivateProSubscription,
  grantReportUnlock,
  recordPurchaseEvent,
  syncSubscriptionFromPayload,
} from '../api/_lib/billing.js';
import { PROFILE_LEMON_COLUMNS } from '../api/_lib/billingSchema.js';
import type { LemonWebhookPayload } from '../api/_lib/lemonSqueezy.js';

const TEST_USER_ID = process.env.BILLING_TEST_USER_ID ?? '6b78d308-f185-4a40-82f7-7355675a6d5b';
const SUB_ID = 'sim-sub-999001';
const CUSTOMER_ID = 'sim-cust-888001';
const ORDER_ID = 'sim-order-777001';
const UNLOCK_REPORT_ID = 'resume_analysis:sim-report-001';

function subscriptionPayload(
  status: string,
  overrides: Record<string, unknown> = {},
): LemonWebhookPayload {
  return {
    meta: {
      event_name: 'subscription_updated',
      custom_data: { user_id: TEST_USER_ID, checkout_type: 'pro' },
    },
    data: {
      type: 'subscriptions',
      id: SUB_ID,
      attributes: {
        status,
        customer_id: CUSTOMER_ID,
        renews_at: '2026-07-17T00:00:00.000000Z',
        ends_at: null,
        ...overrides,
      },
    },
  };
}

async function readProfile(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from('profiles')
    .select(
      'plan, subscription_status, is_pro, subscription_expires_at, unlocked_reports, lemonsqueezy_customer_id, lemonsqueezy_subscription_id',
    )
    .eq('user_id', TEST_USER_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function assertProfile(
  profile: Awaited<ReturnType<typeof readProfile>>,
  expected: Record<string, unknown>,
  label: string,
) {
  for (const [key, value] of Object.entries(expected)) {
    const actual = profile?.[key as keyof typeof profile];
    if (key.endsWith('_at') && typeof value === 'string' && typeof actual === 'string') {
      const expectedMs = new Date(value).getTime();
      const actualMs = new Date(actual).getTime();
      if (Number.isNaN(expectedMs) || Number.isNaN(actualMs) || expectedMs !== actualMs) {
        throw new Error(
          `${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual)}`,
        );
      }
      continue;
    }
    if (actual !== value) {
      throw new Error(
        `${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual)}`,
      );
    }
  }
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL');
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  console.log('=== Delete test profile (simulate missing row) ===');
  await admin.from('profiles').delete().eq('user_id', TEST_USER_ID);
  let profile = await readProfile(admin);
  if (profile !== null) {
    throw new Error('Expected no profile row after delete');
  }
  console.log('profile row: missing (OK)');

  console.log('\n=== Pro flow: order_created → recordPurchaseEvent ===');
  await recordPurchaseEvent({
    eventKey: `sim:order_created:${ORDER_ID}`,
    eventName: 'order_created',
    userId: TEST_USER_ID,
    purchaseType: 'subscription',
    lemonOrderId: ORDER_ID,
    reportId: null,
    amountCents: 500,
    currency: 'USD',
    payload: {
      meta: { event_name: 'order_created', custom_data: { user_id: TEST_USER_ID, checkout_type: 'pro' } },
      data: { type: 'orders', id: ORDER_ID, attributes: { status: 'paid', total: 500 } },
    },
  });

  console.log('\n=== Pro flow: subscription_created → activateProSubscription (upsert) ===');
  await activateProSubscription(
    TEST_USER_ID,
    SUB_ID,
    CUSTOMER_ID,
    'active',
    '2026-07-17T00:00:00.000000Z',
  );
  profile = await readProfile(admin);
  console.log('profiles:', profile);
  await assertProfile(profile, {
    plan: 'pro',
    subscription_status: 'active',
    is_pro: true,
    subscription_expires_at: '2026-07-17T00:00:00.000Z',
    lemonsqueezy_customer_id: CUSTOMER_ID,
    lemonsqueezy_subscription_id: SUB_ID,
  }, 'activateProSubscription');

  console.log('\n=== subscription_updated (active) → syncSubscriptionFromPayload ===');
  await syncSubscriptionFromPayload(TEST_USER_ID, subscriptionPayload('active'));
  profile = await readProfile(admin);
  await assertProfile(profile, {
    plan: 'pro',
    subscription_status: 'active',
    is_pro: true,
    subscription_expires_at: '2026-07-17T00:00:00.000Z',
  }, 'sync active');

  console.log('\n=== subscription_payment_success (paid, no renews_at) preserves expires ===');
  await syncSubscriptionFromPayload(
    TEST_USER_ID,
    {
      meta: {
        event_name: 'subscription_payment_success',
        custom_data: { user_id: TEST_USER_ID, checkout_type: 'pro' },
      },
      data: {
        type: 'subscription-invoices',
        id: 'sim-invoice-001',
        attributes: {
          status: 'paid',
          subscription_id: SUB_ID,
          customer_id: CUSTOMER_ID,
        },
      },
    },
  );
  profile = await readProfile(admin);
  await assertProfile(profile, {
    plan: 'pro',
    subscription_status: 'active',
    is_pro: true,
    subscription_expires_at: '2026-07-17T00:00:00.000Z',
  }, 'payment success preserves expires');

  console.log('\n=== subscription_cancelled (grace) → syncSubscriptionFromPayload ===');
  await syncSubscriptionFromPayload(
    TEST_USER_ID,
    subscriptionPayload('cancelled', { ends_at: '2099-08-17T00:00:00.000000Z' }),
  );
  profile = await readProfile(admin);
  await assertProfile(profile, {
    subscription_status: 'cancelled',
    is_pro: true,
    subscription_expires_at: '2099-08-17T00:00:00.000Z',
  }, 'sync cancelled grace');

  console.log('\n=== subscription_expired → deactivateProSubscription ===');
  await deactivateProSubscription(TEST_USER_ID, '2026-06-17T00:00:00.000000Z');
  profile = await readProfile(admin);
  await assertProfile(profile, { plan: 'free', is_pro: false, subscription_status: 'inactive' }, 'deactivate');

  console.log('\n=== Unlock flow: grantReportUnlock (profile exists) ===');
  await grantReportUnlock(TEST_USER_ID, UNLOCK_REPORT_ID);
  profile = await readProfile(admin);
  const unlocked = Array.isArray(profile?.unlocked_reports) ? profile.unlocked_reports : [];
  if (!unlocked.includes(UNLOCK_REPORT_ID)) {
    throw new Error('grantReportUnlock did not persist unlocked_reports');
  }
  console.log('unlocked_reports:', unlocked);

  console.log('\n=== Unlock flow: grantReportUnlock after profile delete (auto-create) ===');
  await admin.from('profiles').delete().eq('user_id', TEST_USER_ID);
  await grantReportUnlock(TEST_USER_ID, UNLOCK_REPORT_ID);
  profile = await readProfile(admin);
  if (!profile) throw new Error('grantReportUnlock should have created profile');
  const unlockedAfterCreate = Array.isArray(profile.unlocked_reports) ? profile.unlocked_reports : [];
  if (!unlockedAfterCreate.includes(UNLOCK_REPORT_ID)) {
    throw new Error('grantReportUnlock after delete did not persist unlock');
  }
  console.log('profile recreated with unlock:', unlockedAfterCreate);

  const { count } = await admin
    .from('purchase_events')
    .select('id', { count: 'exact', head: true })
    .like('lemon_event_key', 'sim:%');
  console.log('\n=== Summary ===');
  console.log('Simulated purchase_events rows:', count);
  console.log('All billing simulations PASSED');
}

main().catch((err) => {
  console.error('SIMULATION FAILED:', err);
  process.exit(1);
});

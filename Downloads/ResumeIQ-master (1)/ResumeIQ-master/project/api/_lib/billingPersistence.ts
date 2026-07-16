import { getSupabaseAdmin } from './supabaseAdmin.js';
import { PROFILE_LEMON_COLUMNS } from './billingSchema.js';

export type BillingLogContext = {
  operation: string;
  userId: string;
  checkoutType?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  eventName?: string | null;
};

export type ProfileBillingRow = {
  plan: string;
  subscription_status: string;
  is_pro: boolean;
  subscription_expires_at: string | null;
  lemonsqueezy_customer_id: string | null;
  lemonsqueezy_subscription_id: string | null;
  unlocked_reports: unknown;
};

const BILLING_SELECT =
  'plan, subscription_status, is_pro, subscription_expires_at, lemonsqueezy_customer_id, lemonsqueezy_subscription_id, unlocked_reports';

function serializeLog(
  ctx: BillingLogContext,
  level: 'info' | 'error',
  message: string,
  extra?: Record<string, unknown>,
) {
  const payload = {
    level,
    message,
    operation: ctx.operation,
    user_id: ctx.userId,
    checkout_type: ctx.checkoutType ?? null,
    subscription_id: ctx.subscriptionId ?? null,
    customer_id: ctx.customerId ?? null,
    event_name: ctx.eventName ?? null,
    ...extra,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error('[billing]', line);
  } else {
    console.info('[billing]', line);
  }
}

export function billingLog(
  ctx: BillingLogContext,
  message: string,
  extra?: Record<string, unknown>,
) {
  serializeLog(ctx, 'info', message, extra);
}

export function billingError(
  ctx: BillingLogContext,
  message: string,
  extra?: Record<string, unknown>,
) {
  serializeLog(ctx, 'error', message, extra);
}

export async function readProfileBilling(userId: string): Promise<ProfileBillingRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select(BILLING_SELECT)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read profile billing: ${error.message}`);
  }
  if (!data) return null;

  return {
    plan: String(data.plan ?? 'free'),
    subscription_status: String(data.subscription_status ?? 'inactive'),
    is_pro: Boolean(data.is_pro),
    subscription_expires_at:
      typeof data.subscription_expires_at === 'string' ? data.subscription_expires_at : null,
    lemonsqueezy_customer_id:
      typeof data.lemonsqueezy_customer_id === 'string' ? data.lemonsqueezy_customer_id : null,
    lemonsqueezy_subscription_id:
      typeof data.lemonsqueezy_subscription_id === 'string'
        ? data.lemonsqueezy_subscription_id
        : null,
    unlocked_reports: data.unlocked_reports,
  };
}

function normalizeUnlockedReports(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
  return [];
}

function valuesMatch(field: string, expected: unknown, actual: unknown): boolean {
  if (field === 'unlocked_reports') {
    const a = normalizeUnlockedReports(actual).sort().join(',');
    const b = normalizeUnlockedReports(expected).sort().join(',');
    return a === b;
  }
  if (expected === null || expected === undefined) {
    return actual === null || actual === undefined;
  }
  return String(actual) === String(expected);
}

export async function verifyProfileBilling(
  userId: string,
  expected: Partial<ProfileBillingRow>,
  ctx: BillingLogContext,
): Promise<ProfileBillingRow> {
  const actual = await readProfileBilling(userId);
  if (!actual) {
    billingError(ctx, 'verify_no_profile_row', { profile_exists: false });
    throw new Error('Billing verification failed: profile row missing after write.');
  }

  for (const [field, expectedValue] of Object.entries(expected)) {
    const key = field as keyof ProfileBillingRow;
    const actualValue = actual[key];
    if (!valuesMatch(field, expectedValue, actualValue)) {
      billingError(ctx, 'verify_field_mismatch', {
        field,
        expected: expectedValue,
        actual: actualValue,
        profile_exists: true,
      });
      throw new Error(
        `Billing verification failed: ${field} expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
      );
    }
  }

  billingLog(ctx, 'verify_ok', {
    profile_exists: true,
    rows_affected: 1,
    write_result: 'verified',
    plan: actual.plan,
    subscription_status: actual.subscription_status,
    is_pro: actual.is_pro,
  });

  return actual;
}

export async function profileExists(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check profile existence: ${error.message}`);
  }
  return Boolean(data?.user_id);
}

export async function persistProfileBilling(
  userId: string,
  input: {
    plan: string;
    subscription_status: string;
    is_pro: boolean;
    customer_id?: string | null;
    subscription_id?: string | null;
    expires_at?: string | null;
    unlocked_reports?: string[] | null;
  },
  ctx: BillingLogContext,
  verify: Partial<ProfileBillingRow>,
): Promise<ProfileBillingRow> {
  const admin = getSupabaseAdmin();
  const existsBefore = await profileExists(userId);

  billingLog(ctx, 'rpc_persist_attempt', {
    profile_exists: existsBefore,
    plan: input.plan,
    subscription_status: input.subscription_status,
    is_pro: input.is_pro,
  });

  const { error } = await admin.rpc('apply_profile_billing', {
    p_user_id: userId,
    p_plan: input.plan,
    p_subscription_status: input.subscription_status,
    p_is_pro: input.is_pro,
    p_customer_id: input.customer_id ?? null,
    p_subscription_id: input.subscription_id ?? null,
    p_expires_at: input.expires_at ?? null,
    p_unlocked_reports:
      input.unlocked_reports !== null && input.unlocked_reports !== undefined
        ? input.unlocked_reports
        : null,
  });

  if (error) {
    billingError(ctx, 'rpc_persist_failed', {
      error: error.message,
      profile_exists: existsBefore,
    });
    throw new Error(`Failed to persist profile billing: ${error.message}`);
  }

  return verifyProfileBilling(userId, verify, ctx);
}

export async function updateUnlockedReports(
  userId: string,
  unlockedReports: string[],
  ctx: BillingLogContext,
): Promise<ProfileBillingRow> {
  const current = await readProfileBilling(userId);
  const plan = current?.plan ?? 'free';
  const subscriptionStatus = current?.subscription_status ?? 'inactive';
  const isPro = current?.is_pro ?? false;

  return persistProfileBilling(
    userId,
    {
      plan,
      subscription_status: subscriptionStatus,
      is_pro: isPro,
      customer_id: current?.lemonsqueezy_customer_id ?? null,
      subscription_id: current?.lemonsqueezy_subscription_id ?? null,
      expires_at: current?.subscription_expires_at ?? null,
      unlocked_reports: unlockedReports,
    },
    ctx,
    { unlocked_reports: unlockedReports },
  );
}

export { PROFILE_LEMON_COLUMNS };

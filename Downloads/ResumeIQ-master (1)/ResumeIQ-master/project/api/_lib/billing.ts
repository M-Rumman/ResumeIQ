import { getSupabaseAdmin } from './supabaseAdmin.js';
import type { LemonWebhookPayload } from './lemonSqueezy.js';
import { getCustomerId, getResourceId, getSubscriptionExpiresAt } from './lemonSqueezy.js';
import {
  billingError,
  billingLog,
  type BillingLogContext,
  type ProfileBillingRow,
  persistProfileBilling,
  readProfileBilling,
  updateUnlockedReports,
} from './billingPersistence.js';

function normalizeUnlockedReports(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
  if (typeof value === 'string') {
    try {
      return normalizeUnlockedReports(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function billingCtx(
  operation: string,
  userId: string,
  extras: Partial<BillingLogContext> = {},
): BillingLogContext {
  return { operation, userId, ...extras };
}

export type { ProfileBillingRow };

export async function hasProcessedEvent(eventKey: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('purchase_events')
    .select('id')
    .eq('lemon_event_key', eventKey)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function recordPurchaseEvent(input: {
  eventKey: string;
  eventName: string;
  userId: string;
  purchaseType: 'unlock' | 'subscription' | null;
  lemonOrderId?: string | null;
  lemonSubscriptionId?: string | null;
  reportId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  payload: LemonWebhookPayload;
}): Promise<void> {
  const ctx = billingCtx('recordPurchaseEvent', input.userId, {
    eventName: input.eventName,
    checkoutType: input.purchaseType,
    subscriptionId: input.lemonSubscriptionId ?? null,
  });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('purchase_events')
    .insert({
      user_id: input.userId,
      lemon_event_key: input.eventKey,
      event_name: input.eventName,
      purchase_type: input.purchaseType,
      lemon_order_id: input.lemonOrderId ?? null,
      lemon_subscription_id: input.lemonSubscriptionId ?? null,
      report_id: input.reportId ?? null,
      amount_cents: input.amountCents ?? null,
      currency: input.currency ?? 'USD',
      payload: input.payload as unknown as Record<string, unknown>,
    })
    .select('id');

  if (error) {
    if (error.code === '23505') {
      billingLog(ctx, 'purchase_event_duplicate', { rows_affected: 0 });
      return;
    }
    billingError(ctx, 'purchase_event_insert_failed', { error: error.message });
    throw new Error(`Failed to record purchase event: ${error.message}`);
  }

  if (!data || data.length !== 1) {
    billingError(ctx, 'purchase_event_insert_unexpected_rows', {
      rows_affected: data?.length ?? 0,
    });
    throw new Error(
      `purchase_events insert did not persist: expected 1 row, got ${data?.length ?? 0}`,
    );
  }

  billingLog(ctx, 'purchase_event_recorded', {
    rows_affected: 1,
    event_key: input.eventKey,
    write_result: 'insert',
  });
}

export async function getProfileBilling(userId: string): Promise<ProfileBillingRow> {
  try {
    await enforceSubscriptionExpiry(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'enforceSubscriptionExpiry failed';
    console.error('[billing/getProfileBilling]', message, err);
  }
  const row = await readProfileBilling(userId);
  if (row) return row;
  return defaultProfileBilling();
}

export async function grantReportUnlock(userId: string, reportId: string): Promise<void> {
  const ctx = billingCtx('grantReportUnlock', userId, { checkoutType: 'unlock' });
  const current = await getProfileBilling(userId);
  const existing = normalizeUnlockedReports(current.unlocked_reports);

  if (existing.includes(reportId)) {
    billingLog(ctx, 'unlock_already_granted', { report_id: reportId, rows_affected: 0 });
    return;
  }

  await updateUnlockedReports(userId, [...existing, reportId], ctx);
}

export async function revokeReportUnlock(userId: string, reportId: string): Promise<void> {
  const ctx = billingCtx('revokeReportUnlock', userId, { checkoutType: 'unlock' });
  const current = await getProfileBilling(userId);
  const existing = normalizeUnlockedReports(current.unlocked_reports);
  const next = existing.filter((id) => id !== reportId);

  await updateUnlockedReports(userId, next, ctx);
}

function defaultProfileBilling(): ProfileBillingRow {
  return {
    plan: 'free',
    subscription_status: 'inactive',
    is_pro: false,
    subscription_expires_at: null,
    lemonsqueezy_customer_id: null,
    lemonsqueezy_subscription_id: null,
    unlocked_reports: [],
  };
}

function isSubscriptionExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiresMs = new Date(expiresAt).getTime();
  return !Number.isNaN(expiresMs) && expiresMs <= Date.now();
}

function computeIsPro(
  plan: string,
  subscriptionStatus: string,
  expiresAt: string | null = null,
): boolean {
  if (plan !== 'pro') return false;
  const status = subscriptionStatus.toLowerCase();
  if (status === 'expired') return false;
  if (isSubscriptionExpired(expiresAt)) return false;
  if (status === 'active' || status === 'trialing') return true;
  if (status === 'cancelled' && expiresAt) {
    return !isSubscriptionExpired(expiresAt);
  }
  return false;
}

export function profileHasProAccess(row: ProfileBillingRow): boolean {
  if (row.subscription_status.toLowerCase() === 'expired') return false;
  if (isSubscriptionExpired(row.subscription_expires_at)) return false;
  if (row.is_pro && row.plan === 'pro') return true;
  return computeIsPro(row.plan, row.subscription_status, row.subscription_expires_at);
}

/** Canonical server-side Pro check — loads profile and applies expiry rules. */
export async function userHasProAccess(userId: string): Promise<boolean> {
  const billing = await getProfileBilling(userId);
  return profileHasProAccess(billing);
}

export async function enforceSubscriptionExpiry(userId: string): Promise<void> {
  const row = await readProfileBilling(userId);
  if (!row || row.plan !== 'pro' || !row.subscription_expires_at) return;

  if (!isSubscriptionExpired(row.subscription_expires_at)) return;

  const status = row.subscription_status.toLowerCase();
  const needsDowngrade =
    row.is_pro ||
    row.plan === 'pro' ||
    status === 'active' ||
    status === 'trialing' ||
    status === 'cancelled';

  if (!needsDowngrade) return;

  const ctx = billingCtx('enforceSubscriptionExpiry', userId, { checkoutType: 'pro' });
  billingLog(ctx, 'subscription_past_expiry', {
    subscription_expires_at: row.subscription_expires_at,
    subscription_status: row.subscription_status,
  });
  await expireProSubscription(userId, row.subscription_expires_at);
}

async function expireProSubscription(
  userId: string,
  subscriptionExpiresAt: string,
): Promise<void> {
  const ctx = billingCtx('expireProSubscription', userId, { checkoutType: 'pro' });
  const current = await readProfileBilling(userId);
  if (!current || current.plan !== 'pro') return;

  await persistProfileBilling(
    userId,
    {
      plan: 'free',
      subscription_status: 'expired',
      is_pro: false,
      expires_at: subscriptionExpiresAt,
    },
    ctx,
    {
      plan: 'free',
      subscription_status: 'expired',
      is_pro: false,
      subscription_expires_at: subscriptionExpiresAt,
      ...(current.lemonsqueezy_subscription_id
        ? { lemonsqueezy_subscription_id: current.lemonsqueezy_subscription_id }
        : {}),
      ...(current.lemonsqueezy_customer_id
        ? { lemonsqueezy_customer_id: current.lemonsqueezy_customer_id }
        : {}),
    },
  );
}

export async function activateProSubscription(
  userId: string,
  subscriptionId: string,
  customerId: string | null,
  subscriptionStatus: 'active' | 'trialing',
  subscriptionExpiresAt: string | null = null,
): Promise<void> {
  const ctx = billingCtx('activateProSubscription', userId, {
    checkoutType: 'pro',
    subscriptionId,
    customerId,
  });

  await persistProfileBilling(
    userId,
    {
      plan: 'pro',
      subscription_status: subscriptionStatus,
      is_pro: computeIsPro('pro', subscriptionStatus, subscriptionExpiresAt),
      customer_id: customerId,
      subscription_id: subscriptionId,
      expires_at: subscriptionExpiresAt,
    },
    ctx,
    {
      plan: 'pro',
      subscription_status: subscriptionStatus,
      is_pro: computeIsPro('pro', subscriptionStatus, subscriptionExpiresAt),
      lemonsqueezy_subscription_id: subscriptionId,
      ...(customerId ? { lemonsqueezy_customer_id: customerId } : {}),
      ...(subscriptionExpiresAt ? { subscription_expires_at: subscriptionExpiresAt } : {}),
    },
  );
}

export async function deactivateProSubscription(
  userId: string,
  subscriptionExpiresAt: string | null = null,
): Promise<void> {
  const ctx = billingCtx('deactivateProSubscription', userId, { checkoutType: 'pro' });
  const current = await readProfileBilling(userId);

  await persistProfileBilling(
    userId,
    {
      plan: 'free',
      subscription_status: 'inactive',
      is_pro: false,
      subscription_id: null,
      expires_at: subscriptionExpiresAt,
    },
    ctx,
    {
      plan: 'free',
      subscription_status: 'inactive',
      is_pro: false,
      ...(current?.lemonsqueezy_subscription_id
        ? { lemonsqueezy_subscription_id: current.lemonsqueezy_subscription_id }
        : {}),
      ...(current?.lemonsqueezy_customer_id
        ? { lemonsqueezy_customer_id: current.lemonsqueezy_customer_id }
        : {}),
    },
  );
}

export async function syncSubscriptionFromPayload(
  userId: string,
  payload: LemonWebhookPayload,
): Promise<void> {
  const status = getSubscriptionStatusFromPayload(payload);
  const subscriptionId = await resolveSubscriptionIdForPayload(userId, payload);
  const customerId = getCustomerId(payload);
  const subscriptionExpiresAt = await resolveSubscriptionExpiresAt(userId, payload);

  const ctx = billingCtx('syncSubscriptionFromPayload', userId, {
    checkoutType: 'pro',
    subscriptionId,
    customerId,
    eventName: payload.meta?.event_name ?? null,
  });

  billingLog(ctx, 'sync_subscription', { subscription_status: status });

  if (status === 'active' || status === 'paid') {
    await activateProSubscription(
      userId,
      subscriptionId,
      customerId,
      'active',
      subscriptionExpiresAt,
    );
    return;
  }

  if (status === 'on_trial') {
    await activateProSubscription(
      userId,
      subscriptionId,
      customerId,
      'trialing',
      subscriptionExpiresAt,
    );
    return;
  }

  if (status === 'cancelled') {
    const endsAt = subscriptionExpiresAt;
    const endsMs = endsAt ? new Date(endsAt).getTime() : NaN;
    if (!Number.isNaN(endsMs) && endsMs > Date.now()) {
      await persistProfileBilling(
        userId,
        {
          plan: 'pro',
          subscription_status: 'cancelled',
          is_pro: computeIsPro('pro', 'cancelled', endsAt),
          customer_id: customerId,
          subscription_id: subscriptionId,
          expires_at: endsAt,
        },
        ctx,
        {
          plan: 'pro',
          subscription_status: 'cancelled',
          is_pro: computeIsPro('pro', 'cancelled', endsAt),
          subscription_expires_at: endsAt,
          lemonsqueezy_subscription_id: subscriptionId,
          ...(customerId ? { lemonsqueezy_customer_id: customerId } : {}),
        },
      );
      return;
    }
    await deactivateProSubscription(userId, endsAt);
    return;
  }

  if (['expired', 'paused', 'unpaid', 'past_due'].includes(status)) {
    await deactivateProSubscription(userId, subscriptionExpiresAt);
    return;
  }

  await deactivateProSubscription(userId, subscriptionExpiresAt);
}

const SUBSCRIPTION_SYNC_EVENTS = [
  'subscription_created',
  'subscription_updated',
  'subscription_payment_success',
  'subscription_cancelled',
  'subscription_expired',
];

export async function syncBillingFromStoredEvents(userId: string): Promise<ProfileBillingRow> {
  const admin = getSupabaseAdmin();
  const ctx = billingCtx('syncBillingFromStoredEvents', userId, { checkoutType: 'pro' });

  const { data: subscriptionEvents, error: subscriptionError } = await admin
    .from('purchase_events')
    .select('event_name, payload')
    .eq('user_id', userId)
    .eq('purchase_type', 'subscription')
    .in('event_name', SUBSCRIPTION_SYNC_EVENTS)
    .order('created_at', { ascending: false })
    .limit(1);

  if (subscriptionError) {
    throw new Error(`Failed to load subscription events: ${subscriptionError.message}`);
  }

  const latest = subscriptionEvents?.[0];
  if (latest?.payload && typeof latest.payload === 'object') {
    billingLog(ctx, 'replaying_subscription_event', {
      event_name: latest.event_name,
      profile_exists: await profileExists(userId),
    });
    await syncSubscriptionFromPayload(userId, latest.payload as LemonWebhookPayload);
  } else {
    billingLog(ctx, 'no_subscription_event_to_replay', {
      profile_exists: await profileExists(userId),
    });
  }

  return getProfileBilling(userId);
}

async function profileExists(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data?.user_id);
}

function getSubscriptionStatusFromPayload(payload: LemonWebhookPayload): string {
  const status = payload.data?.attributes?.status;
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  if (normalized === 'paid') return 'active';
  return normalized;
}

async function resolveSubscriptionIdForPayload(
  userId: string,
  payload: LemonWebhookPayload,
): Promise<string> {
  const resourceType = payload.data?.type ?? '';
  const resourceId = getResourceId(payload);

  if (resourceType === 'subscriptions' && resourceId) {
    return resourceId;
  }

  const attrSubscriptionId = payload.data?.attributes?.subscription_id;
  if (attrSubscriptionId != null && String(attrSubscriptionId).length > 0) {
    return String(attrSubscriptionId);
  }

  const profile = await getProfileBilling(userId);
  if (profile.lemonsqueezy_subscription_id) {
    return profile.lemonsqueezy_subscription_id;
  }

  if (!resourceId) {
    throw new Error('Subscription webhook missing subscription id.');
  }

  return resourceId;
}

async function resolveSubscriptionExpiresAt(
  userId: string,
  payload: LemonWebhookPayload,
): Promise<string | null> {
  const fromPayload = getSubscriptionExpiresAt(payload);
  if (fromPayload) return fromPayload;

  const profile = await readProfileBilling(userId);
  if (profile?.subscription_expires_at) return profile.subscription_expires_at;

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('purchase_events')
    .select('payload')
    .eq('user_id', userId)
    .eq('purchase_type', 'subscription')
    .in('event_name', ['subscription_created', 'subscription_updated'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.payload && typeof data.payload === 'object') {
    const fromStored = getSubscriptionExpiresAt(data.payload as LemonWebhookPayload);
    if (fromStored) return fromStored;
  }

  return null;
}

export async function findUserIdForOrderRefund(
  payload: LemonWebhookPayload,
): Promise<{ userId: string; reportId: string | null } | null> {
  const orderId = getResourceId(payload);
  if (!orderId) return null;

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('purchase_events')
    .select('user_id, report_id')
    .eq('lemon_order_id', orderId)
    .eq('purchase_type', 'unlock')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.user_id) return null;
  return {
    userId: data.user_id,
    reportId: typeof data.report_id === 'string' ? data.report_id : null,
  };
}

export async function findUserIdBySubscriptionId(subscriptionId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('profiles')
    .select('user_id')
    .eq('lemonsqueezy_subscription_id', subscriptionId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function findUserIdFromPurchaseEvents(options: {
  subscriptionId?: string | null;
  orderId?: string | null;
}): Promise<string | null> {
  const admin = getSupabaseAdmin();

  if (options.subscriptionId) {
    const { data } = await admin
      .from('purchase_events')
      .select('user_id')
      .eq('lemon_subscription_id', options.subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  if (options.orderId) {
    const { data } = await admin
      .from('purchase_events')
      .select('user_id')
      .eq('lemon_order_id', options.orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  return null;
}

export async function resolveBillingUserId(
  payload: LemonWebhookPayload,
): Promise<string | null> {
  const custom = payload.meta?.custom_data;
  if (custom && typeof custom === 'object' && typeof custom.user_id === 'string' && custom.user_id) {
    return custom.user_id;
  }

  const resourceId = getResourceId(payload);
  const resourceType = payload.data?.type ?? '';

  if (resourceType === 'subscriptions' && resourceId) {
    const fromProfile = await findUserIdBySubscriptionId(resourceId);
    if (fromProfile) return fromProfile;
    const fromEvents = await findUserIdFromPurchaseEvents({ subscriptionId: resourceId });
    if (fromEvents) return fromEvents;
  }

  if (resourceType === 'orders' && resourceId) {
    const fromEvents = await findUserIdFromPurchaseEvents({ orderId: resourceId });
    if (fromEvents) return fromEvents;
  }

  if (resourceId) {
    const fromProfile = await findUserIdBySubscriptionId(resourceId);
    if (fromProfile) return fromProfile;
    const fromEvents = await findUserIdFromPurchaseEvents({
      subscriptionId: resourceId,
      orderId: resourceId,
    });
    if (fromEvents) return fromEvents;
  }

  return null;
}

export function getAmountCents(payload: LemonWebhookPayload): number | null {
  const total = payload.data?.attributes?.total;
  if (typeof total === 'number') return total;
  if (typeof total === 'string') {
    const parsed = Number.parseInt(total, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function getCurrency(payload: LemonWebhookPayload): string | null {
  const currency = payload.data?.attributes?.currency;
  return typeof currency === 'string' ? currency : null;
}

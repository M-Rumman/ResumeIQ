/**
 * Canonical Supabase column names for Lemon Squeezy billing.
 * profiles uses lemonsqueezy_* ; purchase_events uses lemon_* (order/subscription ids).
 */
export const PROFILE_LEMON_COLUMNS = {
  customerId: 'lemonsqueezy_customer_id',
  subscriptionId: 'lemonsqueezy_subscription_id',
} as const;

export type ProfileLemonColumn =
  (typeof PROFILE_LEMON_COLUMNS)[keyof typeof PROFILE_LEMON_COLUMNS];

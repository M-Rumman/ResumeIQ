import { apiGet } from './api/client.js';
import { isProPlan } from './usageLimits.js';

export type BillingStatus = {
  plan: string;
  subscription_status: string;
  is_pro: boolean;
  subscription_expires_at: string | null;
  unlocked_reports: string[];
};

export async function fetchBillingStatus(): Promise<BillingStatus> {
  return apiGet<BillingStatus>('/api/billing/status');
}

export function isSubscriptionExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiresMs = new Date(expiresAt).getTime();
  return !Number.isNaN(expiresMs) && expiresMs <= Date.now();
}

export function deriveIsPro(
  plan: string,
  subscriptionStatus: string,
  isProFlag: boolean,
  expiresAt: string | null = null,
): boolean {
  const normalizedPlan = (plan || 'free').toLowerCase();
  const normalizedStatus = (subscriptionStatus || 'inactive').toLowerCase();

  if (normalizedStatus === 'expired') return false;
  if (isSubscriptionExpired(expiresAt)) return false;

  if (isProFlag && normalizedPlan === 'pro') return true;

  if (!isProPlan(normalizedPlan) && normalizedPlan !== 'pro') return false;

  if (normalizedStatus === 'active' || normalizedStatus === 'trialing') return true;

  if (normalizedStatus === 'cancelled' && expiresAt) {
    return !isSubscriptionExpired(expiresAt);
  }

  return false;
}

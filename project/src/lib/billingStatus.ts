import { apiGet } from './api/client.js';

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
  if (typeof expiresAt !== 'string' || !expiresAt.trim()) return true;
  const expiresMs = new Date(expiresAt).getTime();
  return !Number.isFinite(expiresMs) || expiresMs <= Date.now();
}

export function deriveIsPro(
  plan: string,
  subscriptionStatus: string,
  _isProFlag: boolean,
  expiresAt: string | null = null,
): boolean {
  const normalizedPlan = (plan || 'free').toLowerCase();
  const normalizedStatus = (subscriptionStatus || 'inactive').toLowerCase();

  return normalizedPlan === 'pro'
    && normalizedStatus === 'active'
    && !isSubscriptionExpired(expiresAt);
}

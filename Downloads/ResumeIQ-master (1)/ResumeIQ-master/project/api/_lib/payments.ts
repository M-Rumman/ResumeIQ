/**
 * Server-side payments feature flag.
 * Uses PAYMENTS_ENABLED only (never VITE_PAYMENTS_ENABLED) so checkout cannot be
 * enabled by client-visible env vars or frontend bypass.
 */
export function isPaymentsEnabled(): boolean {
  const flag = process.env.PAYMENTS_ENABLED?.trim();
  return flag === 'true' || flag === '1';
}

export const PAYMENTS_DISABLED_MESSAGE =
  'Payments are not enabled. Checkout is unavailable during the public beta.';

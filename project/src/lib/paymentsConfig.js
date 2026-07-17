/**
 * Payment feature flag — set VITE_PAYMENTS_ENABLED=true when Lemon Squeezy checkout is live.
 * Default (unset or false): public beta — full feature access, no paywall enforcement.
 */
export const PAYMENTS_ENABLED =
  import.meta.env.VITE_PAYMENTS_ENABLED === 'true' ||
  import.meta.env.VITE_PAYMENTS_ENABLED === '1';

export function hasPremiumAccess({ isPro, reportUnlocked }) {
  if (!PAYMENTS_ENABLED) return true;
  return Boolean(isPro || reportUnlocked);
}

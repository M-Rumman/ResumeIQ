/**
 * Payment feature flag — set VITE_PAYMENTS_ENABLED=true when Lemon Squeezy checkout is live.
 * Default (unset or false): public beta — full feature access, no paywall enforcement.
 */
import { FREE_LAUNCH_MODE } from './launchConfig.js';

/** Checkout and paywalls are disabled: full feature access, no limitations or paywall enforcement. */
export const PAYMENTS_ENABLED = false;

export function hasPremiumAccess({ isPro, reportUnlocked }) {
  if (!PAYMENTS_ENABLED) return true;
  return Boolean(isPro || reportUnlocked);
}

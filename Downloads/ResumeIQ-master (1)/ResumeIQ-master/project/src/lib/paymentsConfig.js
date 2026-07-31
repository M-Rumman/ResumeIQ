/**
 * Payment feature flag — set VITE_PAYMENTS_ENABLED=true when Lemon Squeezy checkout is live.
 * Default (unset or false): public beta — full feature access, no paywall enforcement.
 */
import { FREE_LAUNCH_MODE } from './launchConfig.js';

/** Checkout and paywalls are off throughout the public launch. */
export const PAYMENTS_ENABLED = !FREE_LAUNCH_MODE;

export function hasPremiumAccess({ isPro, reportUnlocked }) {
  if (!PAYMENTS_ENABLED) return true;
  return Boolean(isPro || reportUnlocked);
}

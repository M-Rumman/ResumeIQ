/**
 * Server-side payments feature flag.
 * Uses PAYMENTS_ENABLED only (never VITE_PAYMENTS_ENABLED) so checkout cannot be
 * enabled by client-visible env vars or frontend bypass.
 */
import { FREE_LAUNCH_CHECKOUT_MESSAGE, isFreeLaunchMode } from './launchMode.js';

export function isPaymentsEnabled(): boolean {
  return !isFreeLaunchMode();
}

export const PAYMENTS_DISABLED_MESSAGE =
  FREE_LAUNCH_CHECKOUT_MESSAGE;

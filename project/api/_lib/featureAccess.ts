import { getReconciledProfileBilling, profileHasProAccess } from './billing.js';
import { isPaymentsEnabled } from './payments.js';
import {
  reserveDailyUsage,
  dailyLimitMessage,
  type FeatureType,
} from './dailyUsage.js';

export type AiFeatureAccessResult =
  | { allowed: true; hasPro: boolean; dailyUsageReserved: boolean; dailyUsageResetDate: string | null }
  | { allowed: false; hasPro: boolean; status: 403 | 429; message: string };

/**
 * Server-side entitlement check for AI routes.
 * Pro users (including cancelled grace) bypass daily caps; free users remain subject to daily limits.
 */
export async function verifyAiFeatureAccess(
  userId: string,
  featureType: FeatureType,
): Promise<AiFeatureAccessResult> {
  const billing = await getReconciledProfileBilling(userId);
  const hasPro = profileHasProAccess(billing);

  if (!isPaymentsEnabled()) {
    return { allowed: true, hasPro: false, dailyUsageReserved: false, dailyUsageResetDate: null };
  }

  if (hasPro) {
    return { allowed: true, hasPro: true, dailyUsageReserved: false, dailyUsageResetDate: null };
  }

  const daily = await reserveDailyUsage(userId, featureType);
  if (!daily.allowed) {
    return {
      allowed: false,
      hasPro: false,
      status: 429,
      message: dailyLimitMessage(featureType, daily.limit),
    };
  }

  return { allowed: true, hasPro: false, dailyUsageReserved: daily.reserved, dailyUsageResetDate: daily.resetDate };
}

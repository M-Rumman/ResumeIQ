import { getSupabaseAdmin } from './supabaseAdmin.js';
import { getProfileBilling, profileHasProAccess } from './billing.js';
import { isPaymentsEnabled } from './payments.js';

/** Server-side daily caps (abuse protection — independent of client paywall flag). */
export const FREE_DAILY_RESUME_LIMIT = 3;
export const FREE_DAILY_INTERVIEW_LIMIT = 3;

export const FEATURE_TYPES = {
  RESUME_ANALYSIS: 'resume_analysis',
  INTERVIEW_PREP: 'interview_prep',
} as const;

export type FeatureType = (typeof FEATURE_TYPES)[keyof typeof FEATURE_TYPES];

function getLimitForFeature(featureType: FeatureType): number {
  return featureType === FEATURE_TYPES.RESUME_ANALYSIS
    ? FREE_DAILY_RESUME_LIMIT
    : FREE_DAILY_INTERVIEW_LIMIT;
}

function getTodayUtcRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function isUserPro(userId: string): Promise<boolean> {
  const billing = await getProfileBilling(userId);
  return profileHasProAccess(billing);
}

export async function getTodayUsageCount(
  userId: string,
  featureType: FeatureType,
): Promise<number> {
  const { startIso, endIso } = getTodayUtcRange();
  const admin = getSupabaseAdmin();

  const { count, error } = await admin
    .from('usage_tracking')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature_type', featureType)
    .gte('created_at', startIso)
    .lt('created_at', endIso);

  if (error) {
    console.error('[dailyUsage] count failed', error.message);
    return 0;
  }

  return count ?? 0;
}

export async function checkDailyUsageLimit(
  userId: string,
  featureType: FeatureType,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = getLimitForFeature(featureType);

  if (!isPaymentsEnabled()) {
    return { allowed: true, used: 0, limit };
  }

  if (await isUserPro(userId)) {
    return { allowed: true, used: 0, limit };
  }

  const used = await getTodayUsageCount(userId, featureType);
  return { allowed: used < limit, used, limit };
}

export async function recordDailyUsage(
  userId: string,
  featureType: FeatureType,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('usage_tracking').insert({
    user_id: userId,
    feature_type: featureType,
  });

  if (error) {
    console.error('[dailyUsage] insert failed', error.message);
  }
}

export function dailyLimitMessage(featureType: FeatureType, limit: number): string {
  const label =
    featureType === FEATURE_TYPES.RESUME_ANALYSIS
      ? 'resume analyses'
      : 'interview prep sessions';
  return `Daily limit reached: ${limit} ${label} per day. Try again tomorrow.`;
}

import { getSupabaseAdmin } from './supabaseAdmin.js';

/** Server-side daily caps. The database applies them atomically in UTC. */
export const FREE_DAILY_RESUME_LIMIT = 2;
export const FREE_DAILY_INTERVIEW_LIMIT = 2;

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

/**
 * Resets stale counters and reserves one free request atomically. Reserving
 * before the model call prevents concurrent requests from exceeding the cap.
 */
export async function reserveDailyUsage(
  userId: string,
  featureType: FeatureType,
): Promise<{ allowed: boolean; used: number; limit: number; reserved: boolean; resetDate: string | null }> {
  const limit = getLimitForFeature(featureType);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('consume_free_ai_usage', {
    p_user_id: userId,
    p_feature_type: featureType,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || typeof row.allowed !== 'boolean') {
    console.error('[dailyUsage] reservation failed', error?.message || 'invalid RPC response');
    // Fail closed: a quota-store outage must not silently grant unlimited use.
    return { allowed: false, used: limit, limit, reserved: false, resetDate: null };
  }

  return {
    allowed: row.allowed,
    used: typeof row.used === 'number' ? row.used : limit,
    limit: typeof row.daily_limit === 'number' ? row.daily_limit : limit,
    reserved: row.allowed,
    resetDate: typeof row.reset_date === 'string' ? row.reset_date : null,
  };
}

/** Returns a reserved slot after an AI pipeline failure. */
export async function releaseDailyUsage(userId: string, featureType: FeatureType, resetDate: string | null): Promise<void> {
  if (!resetDate) return;
  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc('release_free_ai_usage', {
    p_user_id: userId,
    p_feature_type: featureType,
    p_usage_date: resetDate,
  });
  if (error) {
    console.error('[dailyUsage] release failed', error.message);
  }
}

/** Retain request events for observability; profile counters are authoritative. */
export async function recordDailyUsage(userId: string, featureType: FeatureType): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('usage_tracking').insert({
    user_id: userId,
    feature_type: featureType,
  });
  if (error) {
    console.error('[dailyUsage] event insert failed', error.message);
  }
}

export function dailyLimitMessage(featureType: FeatureType, _limit: number): string {
  if (featureType === FEATURE_TYPES.RESUME_ANALYSIS) {
    return "You've reached today's free resume analysis limit. Your limit resets tomorrow or you can upgrade to Pro for unlimited analyses.";
  }
  return "You've reached today's free interview preparation limit. Your limit resets tomorrow or upgrade to Pro for unlimited interview preparation.";
}

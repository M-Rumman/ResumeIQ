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
 * Read-only preflight. It never reserves or increments a daily allowance.
 */
export async function checkDailyUsage(
  userId: string,
  featureType: FeatureType,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = getLimitForFeature(featureType);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('profiles')
    .select('resume_analysis_count_today, interview_prep_count_today, last_usage_reset_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[dailyUsage] preflight check failed', error.message);
    return { allowed: false, used: limit, limit };
  }
  const today = new Date().toISOString().slice(0, 10);
  const used = data?.last_usage_reset_date === today
    ? Number(featureType === FEATURE_TYPES.RESUME_ANALYSIS ? data.resume_analysis_count_today : data.interview_prep_count_today) || 0
    : 0;
  return { allowed: used < limit, used, limit };
}

/** Atomically increments only after a complete successful operation. */
export async function commitSuccessfulDailyUsage(userId: string, featureType: FeatureType): Promise<{ committed: boolean; used: number; limit: number }> {
  const limit = getLimitForFeature(featureType);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('complete_free_ai_usage', {
    p_user_id: userId,
    p_feature_type: featureType,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || typeof row.allowed !== 'boolean') {
    console.error('[dailyUsage] completion commit failed', error?.message || 'invalid RPC response');
    return { committed: false, used: limit, limit };
  }
  return { committed: row.allowed, used: typeof row.used === 'number' ? row.used : limit, limit: typeof row.daily_limit === 'number' ? row.daily_limit : limit };
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

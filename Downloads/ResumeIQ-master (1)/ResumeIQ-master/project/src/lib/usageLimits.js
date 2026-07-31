/** Free-plan usage display. The API remains authoritative for enforcement. */
import { supabase } from './supabase.js';
import { PAYMENTS_ENABLED } from './paymentsConfig.js';
import { FREE_DAILY_RESUME_LIMIT, FREE_DAILY_INTERVIEW_LIMIT } from './planConfig.js';
import { deriveIsPro, fetchBillingStatus } from './billingStatus.js';

export const FEATURE_TYPES = {
  RESUME_ANALYSIS: 'resume_analysis',
  INTERVIEW_PREP: 'interview_prep',
};

const PRO_PLAN_ALIASES = new Set(['pro', 'premium', 'paid']);

export function getTodayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function getLimitForFeature(featureType) {
  return featureType === FEATURE_TYPES.RESUME_ANALYSIS
    ? FREE_DAILY_RESUME_LIMIT
    : FREE_DAILY_INTERVIEW_LIMIT;
}

/** @param {string | null | undefined} plan */
export function isProPlan(plan) {
  return PRO_PLAN_ALIASES.has((plan || '').toLowerCase().trim());
}

/** @param {string} userId */
export async function getUserPlan(userId) {
  if (PAYMENTS_ENABLED) {
    try {
      const billing = await fetchBillingStatus();
      const plan = (billing.plan || 'free').toLowerCase();
      const isPro = deriveIsPro(
        billing.plan,
        billing.subscription_status,
        billing.is_pro,
        billing.subscription_expires_at,
      );
      return { plan, isPro, error: null };
    } catch {
      // Fall through to the profile read for local/beta deployments.
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('plan, subscription_status, is_pro, subscription_expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { plan: 'free', isPro: false, error: 'Could not verify your subscription plan.' };

  return {
    plan: (data?.plan || 'free').toLowerCase(),
    isPro: deriveIsPro(
      data?.plan || 'free',
      data?.subscription_status || 'inactive',
      Boolean(data?.is_pro),
      data?.subscription_expires_at ?? null,
    ),
    error: null,
  };
}

/** Reads daily counters. A stale UTC date is displayed as a reset even before the next API request. */
export async function getDailyUsageCounters(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('resume_analysis_count_today, interview_prep_count_today, last_usage_reset_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { resumeAnalysisCountToday: 0, interviewPrepCountToday: 0, error: 'Could not check daily usage. Please try again.' };

  const current = data?.last_usage_reset_date === getTodayUtcDate();
  return {
    resumeAnalysisCountToday: current ? Number(data?.resume_analysis_count_today || 0) : 0,
    interviewPrepCountToday: current ? Number(data?.interview_prep_count_today || 0) : 0,
    error: null,
  };
}

export function getFeatureLabel(featureType) {
  return featureType === FEATURE_TYPES.RESUME_ANALYSIS ? 'Resume Analysis' : 'Interview Preparation';
}

/** Client-side display/preflight only; the server makes the atomic decision. */
export async function checkFeatureAccess(userId, featureType) {
  const limit = getLimitForFeature(featureType);
  if (!PAYMENTS_ENABLED) {
    return { allowed: true, isPro: false, used: 0, limit: Infinity, remaining: Infinity, error: null, upgradeMessage: null };
  }

  const planResult = await getUserPlan(userId);
  if (planResult.error) {
    return { allowed: false, isPro: false, used: 0, limit, remaining: 0, error: planResult.error, upgradeMessage: null };
  }
  if (planResult.isPro) {
    return { allowed: true, isPro: true, used: 0, limit: Infinity, remaining: Infinity, error: null, upgradeMessage: null };
  }

  const counters = await getDailyUsageCounters(userId);
  if (counters.error) {
    return { allowed: false, isPro: false, used: 0, limit, remaining: 0, error: counters.error, upgradeMessage: null };
  }
  const used = featureType === FEATURE_TYPES.RESUME_ANALYSIS
    ? counters.resumeAnalysisCountToday
    : counters.interviewPrepCountToday;
  return { allowed: used < limit, isPro: false, used, limit, remaining: Math.max(0, limit - used), error: null, upgradeMessage: null };
}

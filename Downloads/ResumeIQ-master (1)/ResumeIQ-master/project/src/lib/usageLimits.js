/**
 * ResuV — Free plan usage limits
 * ---------------------------------
 * Lifetime free-trial caps (2 full reports per type) are derived from saved
 * `resume_analysis` / `interview_prep` rows. Server-side daily caps in
 * `usage_tracking` remain for abuse prevention only.
 */

import { supabase } from './supabase.js';
import { PAYMENTS_ENABLED } from './paymentsConfig.js';
import { FREE_TRIAL_REPORT_LIMIT } from './planConfig.js';
import { deriveIsPro, fetchBillingStatus } from './billingStatus.js';

/** Feature identifiers stored in usage_tracking.feature_type */
export const FEATURE_TYPES = {
  RESUME_ANALYSIS: 'resume_analysis',
  INTERVIEW_PREP: 'interview_prep',
};

const FEATURE_TABLES = {
  [FEATURE_TYPES.RESUME_ANALYSIS]: 'resume_analysis',
  [FEATURE_TYPES.INTERVIEW_PREP]: 'interview_prep',
};

const PRO_PLAN_ALIASES = new Set(['pro', 'premium', 'paid']);

/**
 * UTC start/end of "today" for consistent daily reset regardless of client TZ display.
 */
export function getTodayUtcRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * @param {string | null | undefined} plan
 */
export function isProPlan(plan) {
  return PRO_PLAN_ALIASES.has((plan || '').toLowerCase().trim());
}

/**
 * Load the user's plan from profiles.
 * @param {string} userId
 * @returns {Promise<{ plan: string, isPro: boolean, error: string | null }>}
 */
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
      // Fall through to direct profile read.
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('plan, subscription_status, is_pro, subscription_expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { plan: 'free', isPro: false, error: 'Could not verify your subscription plan.' };
  }

  const plan = (data?.plan || 'free').toLowerCase();
  const subscriptionStatus = (data?.subscription_status || 'inactive').toLowerCase();
  const isPro = deriveIsPro(
    plan,
    subscriptionStatus,
    Boolean(data?.is_pro),
    data?.subscription_expires_at ?? null,
  );

  return { plan, isPro, error: null };
}

/**
 * Count saved reports for a feature (lifetime, not daily).
 * @param {string} userId
 * @param {string} featureType
 */
export async function getLifetimeReportCount(userId, featureType) {
  const table = FEATURE_TABLES[featureType];
  if (!table) {
    return { count: 0, error: 'Unknown feature type.' };
  }

  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    return { count: 0, error: 'Could not check usage. Please try again.' };
  }

  return { count: count ?? 0, error: null };
}

/**
 * Count how many times the user used a feature since UTC midnight.
 * @param {string} userId
 * @param {string} featureType
 */
export async function getTodayUsageCount(userId, featureType) {
  const { startIso, endIso } = getTodayUtcRange();

  const { count, error } = await supabase
    .from('usage_tracking')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature_type', featureType)
    .gte('created_at', startIso)
    .lt('created_at', endIso);

  if (error) {
    return { count: 0, error: 'Could not check usage limits. Please try again.' };
  }

  return { count: count ?? 0, error: null };
}

/**
 * Human-readable label for UI messages.
 * @param {string} featureType
 */
export function getFeatureLabel(featureType) {
  if (featureType === FEATURE_TYPES.RESUME_ANALYSIS) return 'Resume Analyses';
  if (featureType === FEATURE_TYPES.INTERVIEW_PREP) return 'Interview Prep reports';
  return 'reports';
}

/**
 * Check feature usage for banners. Free users may always generate reports;
 * paywall gating on the result page is handled by paywallAccess.
 * @param {string} userId
 * @param {string} featureType
 * @returns {Promise<{
 *   allowed: boolean;
 *   isPro: boolean;
 *   used: number;
 *   limit: number;
 *   remaining: number;
 *   error: string | null;
 *   upgradeMessage: string | null;
 * }>}
 */
export async function checkFeatureAccess(userId, featureType) {
  const limit = FREE_TRIAL_REPORT_LIMIT;

  if (!PAYMENTS_ENABLED) {
    return {
      allowed: true,
      isPro: false,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      error: null,
      upgradeMessage: null,
    };
  }

  const planResult = await getUserPlan(userId);
  if (planResult.error) {
    return {
      allowed: false,
      isPro: false,
      used: 0,
      limit,
      remaining: 0,
      error: planResult.error,
      upgradeMessage: null,
    };
  }

  if (planResult.isPro) {
    return {
      allowed: true,
      isPro: true,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      error: null,
      upgradeMessage: null,
    };
  }

  const usageResult = await getLifetimeReportCount(userId, featureType);
  if (usageResult.error) {
    return {
      allowed: false,
      isPro: false,
      used: 0,
      limit,
      remaining: 0,
      error: usageResult.error,
      upgradeMessage: null,
    };
  }

  const used = usageResult.count;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: true,
    isPro: false,
    used,
    limit,
    remaining,
    error: null,
    upgradeMessage: null,
  };
}

/**
 * Record one successful feature use (call after the action completes).
 * Usage rows are inserted server-side by /api/analyze-resume and /api/interview-prep.
 * Client inserts are blocked by RLS (service role only).
 * @param {string} userId
 * @param {string} featureType
 */
export async function recordFeatureUsage(_userId, _featureType) {
  return { ok: true, error: null };
}

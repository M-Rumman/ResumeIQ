/**
 * Paywall access — read-only profile checks for UI gating.
 * Billing mutations (Pro / unlocks) go through Lemon Squeezy webhooks only.
 */

import { supabase } from './supabase.js';
import { PAYMENTS_ENABLED } from './paymentsConfig.js';
import { buildReportId } from './monetizationConfig.js';
import { FREE_DAILY_INTERVIEW_LIMIT, FREE_DAILY_RESUME_LIMIT } from './planConfig.js';
import { deriveIsPro, fetchBillingStatus } from './billingStatus.js';

/**
 * @typedef {Object} PaywallProfile
 * @property {string} plan
 * @property {boolean} isPro
 * @property {string} subscriptionStatus
 * @property {string[]} unlockedReports
 * @property {string[]} dailyFreeReportIds
 * @property {string | null} error
 */

function getTodayUtcRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * Free reports generated today remain fully readable. Earlier reports retain
 * the existing Pro/per-report-unlock behaviour, so daily usage replaces the
 * lifetime trial without removing payment entitlements.
 */
export async function getDailyFreeReportIds(userId) {
  const { startIso, endIso } = getTodayUtcRange();
  const [resumeRes, interviewRes] = await Promise.all([
    supabase.from('resume_analysis').select('id').eq('user_id', userId)
      .gte('created_at', startIso).lt('created_at', endIso)
      .order('created_at', { ascending: true }).limit(FREE_DAILY_RESUME_LIMIT),
    supabase.from('interview_prep').select('id').eq('user_id', userId)
      .gte('created_at', startIso).lt('created_at', endIso)
      .order('created_at', { ascending: true }).limit(FREE_DAILY_INTERVIEW_LIMIT),
  ]);
  return [
    ...(resumeRes.data ?? []).map((row) => buildReportId('resume_analysis', row.id)),
    ...(interviewRes.data ?? []).map((row) => buildReportId('interview_prep', row.id)),
  ];
}

/**
 * @param {string} userId
 * @returns {Promise<PaywallProfile>}
 */
export async function getPaywallProfile(userId) {
  if (PAYMENTS_ENABLED) {
    try {
      const billing = await fetchBillingStatus();
      const plan = (billing.plan || 'free').toLowerCase();
      const subscriptionStatus = (billing.subscription_status || 'inactive').toLowerCase();
      const unlockedReports = normalizeUnlockedReports(billing.unlocked_reports);
      const isPro = deriveIsPro(
        billing.plan,
        billing.subscription_status,
        billing.is_pro,
        billing.subscription_expires_at,
      );

      const dailyFreeReportIds = isPro ? [] : await getDailyFreeReportIds(userId);
      return {
        plan,
        isPro,
        subscriptionStatus,
        unlockedReports,
        dailyFreeReportIds,
        error: null,
      };
    } catch {
      return {
        plan: 'free',
        isPro: false,
        subscriptionStatus: 'inactive',
        unlockedReports: [],
        dailyFreeReportIds: [],
        error: 'Could not load your account access.',
      };
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('plan, subscription_status, is_pro, subscription_expires_at, unlocked_reports')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return {
      plan: 'free',
      isPro: false,
      subscriptionStatus: 'inactive',
      unlockedReports: [],
      dailyFreeReportIds: [],
      error: 'Could not load your account access.',
    };
  }

  const plan = (data?.plan || 'free').toLowerCase();
  const subscriptionStatus = (data?.subscription_status || 'inactive').toLowerCase();
  const unlockedReports = normalizeUnlockedReports(data?.unlocked_reports);

  const isPro = deriveIsPro(
    plan,
    subscriptionStatus,
    Boolean(data?.is_pro),
    data?.subscription_expires_at ?? null,
  );

  const dailyFreeReportIds = isPro ? [] : await getDailyFreeReportIds(userId);
  return {
    plan,
    isPro,
    subscriptionStatus,
    unlockedReports,
    dailyFreeReportIds,
    error: null,
  };
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeUnlockedReports(value) {
  if (Array.isArray(value)) {
    return value.filter((id) => typeof id === 'string' && id.length > 0);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeUnlockedReports(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Full report visibility: Pro, per-report unlock, or a report generated under
 * the current UTC day's free quota. The API remains authoritative for quota.
 * @param {PaywallProfile} profile
 * @param {string | null | undefined} reportId
 */
export function hasFullReportAccess(profile, reportId) {
  if (!PAYMENTS_ENABLED) return true;
  if (profile.isPro) return true;
  if (!reportId) return false;
  return profile.unlockedReports.includes(reportId) || profile.dailyFreeReportIds.includes(reportId);
}

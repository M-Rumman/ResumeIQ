/**
 * Paywall access — read-only profile checks for UI gating.
 * Billing mutations (Pro / unlocks) go through Lemon Squeezy webhooks only.
 */

import { supabase } from './supabase.js';
import { PAYMENTS_ENABLED } from './paymentsConfig.js';
import { buildReportId } from './monetizationConfig.js';
import { FREE_TRIAL_REPORT_LIMIT } from './planConfig.js';
import { deriveIsPro, fetchBillingStatus } from './billingStatus.js';

/**
 * @typedef {Object} PaywallProfile
 * @property {string} plan
 * @property {boolean} isPro
 * @property {string} subscriptionStatus
 * @property {string[]} unlockedReports
 * @property {string[]} freeTrialReportIds
 * @property {string | null} error
 */

/**
 * Oldest saved reports per type that qualify for the lifetime free trial.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function getFreeTrialReportIds(userId) {
  const [resumeRes, interviewRes] = await Promise.all([
    supabase
      .from('resume_analysis')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(FREE_TRIAL_REPORT_LIMIT),
    supabase
      .from('interview_prep')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(FREE_TRIAL_REPORT_LIMIT),
  ]);

  const ids = [];
  for (const row of resumeRes.data ?? []) {
    ids.push(buildReportId('resume_analysis', row.id));
  }
  for (const row of interviewRes.data ?? []) {
    ids.push(buildReportId('interview_prep', row.id));
  }
  return ids;
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

      let freeTrialReportIds = [];
      if (!isPro) {
        freeTrialReportIds = await getFreeTrialReportIds(userId);
      }

      return {
        plan,
        isPro,
        subscriptionStatus,
        unlockedReports,
        freeTrialReportIds,
        error: null,
      };
    } catch {
      return {
        plan: 'free',
        isPro: false,
        subscriptionStatus: 'inactive',
        unlockedReports: [],
        freeTrialReportIds: [],
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
      freeTrialReportIds: [],
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

  return {
    plan,
    isPro,
    subscriptionStatus,
    unlockedReports,
    freeTrialReportIds: [],
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
 * Full report visibility: Pro, per-report unlock, or within lifetime free trial.
 * @param {PaywallProfile} profile
 * @param {string | null | undefined} reportId
 */
export function hasFullReportAccess(profile, reportId) {
  if (!PAYMENTS_ENABLED) return true;
  if (profile.isPro) return true;
  if (!reportId) return false;
  if (profile.unlockedReports.includes(reportId)) return true;
  if (profile.freeTrialReportIds.includes(reportId)) return true;
  return false;
}

/**
 * Plan-based feature access (builds on usageLimits for daily caps).
 */

import { getUserPlan, isProPlan } from './usageLimits.js';
import { PAYMENTS_ENABLED } from './paymentsConfig.js';
import {
  FREE_HISTORY_LIMIT,
  FREE_INTERVIEW_QUESTIONS_PER_CATEGORY,
} from './planConfig.js';

export { isProPlan, getUserPlan };

/**
 * Treat as Pro for exports, analytics, and history when payments are disabled (beta).
 * @param {boolean} isPro
 */
export function getEffectivePro(isPro) {
  return !PAYMENTS_ENABLED || Boolean(isPro);
}

/**
 * @param {boolean} isPro
 */
export function getHistoryLimit(isPro) {
  if (!PAYMENTS_ENABLED) return null;
  return isPro ? null : FREE_HISTORY_LIMIT;
}

/**
 * @param {boolean} isPro
 */
export function canExportPdf(isPro) {
  return getEffectivePro(isPro);
}

/**
 * Interview prep tier string for question engine.
 * @param {boolean} isPro
 */
export function getInterviewPrepTier(isPro) {
  return isPro ? 'pro' : 'free';
}

export { FREE_INTERVIEW_QUESTIONS_PER_CATEGORY };

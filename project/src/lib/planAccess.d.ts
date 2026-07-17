export function getHistoryLimit(isPro: boolean): number | null;

export function canExportPdf(isPro: boolean): boolean;

export function getInterviewPrepTier(isPro: boolean): 'free' | 'pro';

export function isProPlan(plan: string | null | undefined): boolean;

export function getUserPlan(
  userId: string,
): Promise<{ plan: string; isPro: boolean; error: string | null }>;

export { FREE_INTERVIEW_QUESTIONS_PER_CATEGORY } from './planConfig.js';

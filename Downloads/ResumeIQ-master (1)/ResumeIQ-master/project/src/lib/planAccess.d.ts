export function isProPlan(plan: string | null | undefined): boolean;
export function getUserPlan(userId: string): Promise<string | null>;
export function getEffectivePro(isPro: boolean): boolean;
export function getHistoryLimit(isPro: boolean): number | null;
export function canExportPdf(isPro: boolean): boolean;
export function getInterviewPrepTier(isPro: boolean): 'pro' | 'free';
export const FREE_INTERVIEW_QUESTIONS_PER_CATEGORY: number;

export const FEATURE_TYPES: {
  RESUME_ANALYSIS: string;
  INTERVIEW_PREP: string;
};

export function checkFeatureAccess(
  userId: string,
  featureType: string,
): Promise<{
  allowed: boolean;
  isPro: boolean;
  used: number;
  limit: number;
  remaining: number;
  error: string | null;
  upgradeMessage: string | null;
}>;

export function recordFeatureUsage(userId: string, featureType: string): Promise<void>;

export function getFeatureLabel(featureType: string): string;

export function getUserPlan(
  userId: string,
): Promise<{ plan: string; isPro: boolean; error: string | null }>;

export function isProPlan(plan: string | null | undefined): boolean;

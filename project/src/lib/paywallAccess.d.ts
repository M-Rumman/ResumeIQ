export interface PaywallProfile {
  plan: string;
  isPro: boolean;
  subscriptionStatus: string;
  unlockedReports: string[];
  freeTrialReportIds: string[];
  error: string | null;
}

export function getFreeTrialReportIds(userId: string): Promise<string[]>;
export function getPaywallProfile(userId: string): Promise<PaywallProfile>;
export function normalizeUnlockedReports(value: unknown): string[];
export function hasFullReportAccess(
  profile: PaywallProfile,
  reportId: string | null | undefined,
): boolean;

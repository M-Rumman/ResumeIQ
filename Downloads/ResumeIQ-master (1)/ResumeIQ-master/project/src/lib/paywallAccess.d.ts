export interface PaywallProfile {
  plan: string;
  isPro: boolean;
  subscriptionStatus: string;
  unlockedReports: string[];
  dailyFreeReportIds: string[];
  error: string | null;
}

export function getPaywallProfile(userId: string): Promise<PaywallProfile>;
export function getDailyFreeReportIds(userId: string): Promise<string[]>;
export function normalizeUnlockedReports(value: unknown): string[];
export function hasFullReportAccess(
  profile: PaywallProfile,
  reportId: string | null | undefined,
): boolean;

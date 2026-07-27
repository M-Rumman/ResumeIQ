export const PAYWALL_PREVIEW_PERCENT: number;
export const ONE_TIME_UNLOCK: { priceDisplay: string; label: string; subtitle: string; trustLine: string };
export const PRO_SUBSCRIPTION: { priceDisplay: string; period: string; label: string; subtitle: string; trustLine: string };
export const PAYWALL_COPY: { upgradeButton: string; unlockButton: string; dismiss: string };
export function getDailyLimitMessage(reportType: string | null): string;
export function parseReportId(reportId: string | null): { type: string | null; recordId: string | null };
export function buildReportId(type: string, recordId: string): string;

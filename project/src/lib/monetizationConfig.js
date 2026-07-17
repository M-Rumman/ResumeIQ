/**
 * ResuV hybrid monetization — pricing display and paywall copy.
 */

/** Visible portion of locked results for free users. */
export const PAYWALL_PREVIEW_PERCENT = 40;

export const ONE_TIME_UNLOCK = {
  priceDisplay: '$2',
  label: 'Unlock This Result',
  subtitle: 'One-time payment',
  trustLine: 'Perfect for single job applications',
};

export const PRO_SUBSCRIPTION = {
  priceDisplay: '$5',
  period: '/month',
  label: 'ResuV Pro',
  subtitle: 'Unlimited resume optimization + interview prep',
  trustLine: 'Best for active job seekers applying to multiple roles',
};

export const PAYWALL_COPY = {
  upgradeButton: 'Upgrade to Pro',
  unlockButton: 'Unlock This Report',
  dismiss: 'View free preview above',
};

/**
 * @param {'resume_analysis' | 'interview_prep' | string | null} reportType
 */
export function getFreeTrialExhaustedMessage(reportType) {
  if (reportType === 'resume_analysis') {
    return "You've already used your 2 free Resume Analyses.";
  }
  if (reportType === 'interview_prep') {
    return "You've already used your 2 free Interview Prep reports.";
  }
  return "You've used your free reports for this feature.";
}

export function parseReportId(reportId) {
  if (!reportId || typeof reportId !== 'string') {
    return { type: null, recordId: null };
  }
  const idx = reportId.indexOf(':');
  if (idx === -1) {
    return { type: null, recordId: reportId };
  }
  return { type: reportId.slice(0, idx), recordId: reportId.slice(idx + 1) };
}

export function buildReportId(type, recordId) {
  return `${type}:${recordId}`;
}

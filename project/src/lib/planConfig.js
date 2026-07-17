/**
 * ResuV plan configuration — single source for pricing copy and feature limits.
 */

export const FREE_DAILY_RESUME_LIMIT = 2;
export const FREE_DAILY_INTERVIEW_LIMIT = 2;
/** Lifetime full-access reports per type for free users (no blur / paywall). */
export const FREE_TRIAL_REPORT_LIMIT = 2;
export const FREE_HISTORY_LIMIT = 5;
export const FREE_INTERVIEW_QUESTIONS_PER_CATEGORY = 3;

export const PRICING_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Start optimizing your resume and interview prep with essential daily tools.',
    cta: 'Get Started Free',
    highlight: false,
    features: [
      { text: '2 full Resume Analyses', included: true },
      { text: '2 full Interview Prep reports', included: true },
      { text: 'Basic ATS Score', included: true },
      { text: 'Resume section analysis', included: true },
      { text: 'Keyword detection', included: true },
      { text: 'Basic interview questions', included: true },
      { text: 'Limited saved history', included: true },
      { text: 'Dashboard access', included: true },
      { text: 'No PDF export', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$5',
    period: '/month',
    description: 'Unlimited usage, full reports, exports, and premium career preparation tools.',
    cta: 'Upgrade to Pro',
    highlight: true,
    badge: 'Most Popular',
    features: [
      { text: 'Unlimited Resume Analyses', included: true },
      { text: 'Unlimited Interview Prep Sessions', included: true },
      { text: 'PDF Export of Reports', included: true },
      { text: 'Advanced Resume Insights', included: true },
      { text: 'Premium Interview Question Sets', included: true },
      { text: 'Full Resume History', included: true },
      { text: 'Enhanced Dashboard Analytics', included: true },
      { text: 'Priority Access to New Features', included: true },
    ],
  },
];

/** Short feature lists for home page pricing preview */
export const HOME_PRICING_PREVIEW = {
  free: [
    { text: '2 Resume Analyses per day', included: true },
    { text: '2 Interview Prep sessions per day', included: true },
    { text: 'Basic ATS, sections & keywords', included: true },
    { text: 'Basic interview questions', included: true },
    { text: 'Limited history · Dashboard access', included: true },
    { text: 'No PDF export', included: false },
  ],
  pro: [
    { text: 'Unlimited analyses & interview prep', included: true },
    { text: 'PDF export of reports', included: true },
    { text: 'Advanced resume insights', included: true },
    { text: 'Premium interview question sets', included: true },
    { text: 'Full history & enhanced analytics', included: true },
    { text: 'Priority access to new features', included: true },
  ],
};

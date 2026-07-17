export type PlanFeature = {
  text: string;
  included: boolean;
};

export type PricingPlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  highlight: boolean;
  badge?: string;
  features: PlanFeature[];
};

export const FREE_DAILY_RESUME_LIMIT: number;
export const FREE_DAILY_INTERVIEW_LIMIT: number;
export const FREE_HISTORY_LIMIT: number;
export const FREE_INTERVIEW_QUESTIONS_PER_CATEGORY: number;
export const PRICING_PLANS: PricingPlan[];
export const HOME_PRICING_PREVIEW: {
  free: PlanFeature[];
  pro: PlanFeature[];
};

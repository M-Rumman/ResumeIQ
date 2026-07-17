import type { VercelResponse } from '@vercel/node';

export const CLIENT_ERRORS = {
  AI_ANALYSIS: 'Analysis failed. Please try again.',
  INTERVIEW_PREP: 'Interview prep failed. Please try again.',
  CHECKOUT: 'Checkout creation failed. Please try again.',
  BILLING_SYNC: 'Billing sync failed. Please try again.',
  BILLING_STATUS: 'Failed to load billing status.',
  MANAGE_SUBSCRIPTION: 'Unable to open the billing portal. Please try again.',
  TESTIMONIAL: 'Could not save your testimonial. Please try again.',
  WEBHOOK: 'Webhook processing failed.',
  INTERNAL: 'Something went wrong. Please try again.',
} as const;

export function logApiError(route: string, err: unknown, extra?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${route}]`, message, extra ?? '');
}

export function respondError(
  res: VercelResponse,
  status: number,
  clientMessage: string,
): VercelResponse {
  return res.status(status).json({ error: clientMessage });
}

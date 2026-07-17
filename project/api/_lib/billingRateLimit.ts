import type { VercelResponse } from '@vercel/node';
import { enforceBillingRateLimit } from './rateLimit.js';

export async function applyBillingRateLimit(
  userId: string,
  res: VercelResponse,
): Promise<boolean> {
  const rate = await enforceBillingRateLimit(userId);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    res.status(429).json({
      error: 'Too many requests. Please wait a moment and try again.',
    });
    return false;
  }
  return true;
}

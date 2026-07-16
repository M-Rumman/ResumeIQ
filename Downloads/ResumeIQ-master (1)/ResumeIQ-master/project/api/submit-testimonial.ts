import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { getClientIp } from './_lib/rateLimit.js';
import { isIpRecentlySubmitted, markIpSubmitted } from './_lib/ipThrottle.js';
import { BODY_LIMITS, rejectOversizedBody } from './_lib/requestLimits.js';
import { CLIENT_ERRORS, logApiError, respondError } from './_lib/safeError.js';

function validateTestimonial(name: unknown, review: unknown): { ok: true; name: string; review: string } | { ok: false; error: string } {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedReview = typeof review === 'string' ? review.trim() : '';

  if (trimmedName.length < 1 || trimmedName.length > 100) {
    return { ok: false, error: 'Name must be between 1 and 100 characters.' };
  }
  if (trimmedReview.length < 10 || trimmedReview.length > 2000) {
    return { ok: false, error: 'Review must be between 10 and 2000 characters.' };
  }

  return { ok: true, name: trimmedName, review: trimmedReview };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectOversizedBody(req, res, BODY_LIMITS.TESTIMONIAL)) {
    return;
  }

  const body = req.body as { name?: unknown; review?: unknown };
  const validated = validateTestimonial(body.name, body.review);
  if (validated.ok === false) {
    return res.status(400).json({ error: validated.error });
  }

  const ip = getClientIp(req);
  if (await isIpRecentlySubmitted(ip)) {
    return res.status(429).json({
      error: 'You already submitted a testimonial recently. Please try again in 24 hours.',
    });
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('testimonials').insert({
      name: validated.name,
      review: validated.review,
    });

    if (error) {
      logApiError('submit-testimonial', error);
      return respondError(res, 500, CLIENT_ERRORS.TESTIMONIAL);
    }

    await markIpSubmitted(ip);
    return res.status(201).json({ ok: true });
  } catch (err) {
    logApiError('submit-testimonial', err);
    return respondError(res, 500, CLIENT_ERRORS.TESTIMONIAL);
  }
}

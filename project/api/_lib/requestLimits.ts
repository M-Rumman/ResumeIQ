import type { VercelRequest, VercelResponse } from '@vercel/node';

export const BODY_LIMITS = {
  AI: 128 * 1024,
  CHECKOUT: 8 * 1024,
  TESTIMONIAL: 8 * 1024,
  DEFAULT: 64 * 1024,
} as const;

export const INPUT_LIMITS = {
  RESUME_TEXT_MAX: 50_000,
  JOB_DESCRIPTION_MAX: 10_000,
  JOB_ROLE_MAX: 500,
  SKILLS_MAX: 2_000,
  REPORT_ID_MAX: 128,
} as const;

function estimateBodyBytes(req: VercelRequest): number | null {
  const contentLength = req.headers['content-length'];
  if (typeof contentLength === 'string') {
    const parsed = Number.parseInt(contentLength, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  if (req.body === undefined || req.body === null) return null;

  try {
    if (typeof req.body === 'string') {
      return Buffer.byteLength(req.body, 'utf8');
    }
    return Buffer.byteLength(JSON.stringify(req.body), 'utf8');
  } catch {
    return null;
  }
}

/** Returns true when the request was rejected (caller should return early). */
export function rejectOversizedBody(
  req: VercelRequest,
  res: VercelResponse,
  maxBytes: number,
): boolean {
  const size = estimateBodyBytes(req);
  if (size !== null && size > maxBytes) {
    res.status(413).json({ error: 'Request payload too large.' });
    return true;
  }
  return false;
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

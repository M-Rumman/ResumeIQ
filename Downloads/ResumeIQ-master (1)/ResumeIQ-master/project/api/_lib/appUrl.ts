/** Canonical production site — used when APP_URL is unset. */
export const DEFAULT_APP_URL = 'https://resuv.app';

/**
 * Resolved public app origin for links, referers, and diagnostics.
 * Priority: APP_URL → VERCEL_URL → production default → localhost.
 */
export function getAppBaseUrl(): string {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }

  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    return DEFAULT_APP_URL;
  }

  return 'http://localhost:3000';
}

/**
 * Lemon Squeezy post-checkout redirect (unlock + Pro subscription).
 * Uses APP_URL when set; otherwise always the canonical production domain
 * (never a transient *.vercel.app preview URL).
 */
export function getPaymentSuccessUrl(): string {
  const fromEnv = process.env.APP_URL?.trim();
  const base = fromEnv ? fromEnv.replace(/\/+$/, '') : DEFAULT_APP_URL;
  return `${base}/?payment=success`;
}

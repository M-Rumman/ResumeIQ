/**
 * Server-side counterpart to VITE_FREE_LAUNCH_MODE. Paid access is the normal
 * default. Lemon Squeezy configuration, webhooks, variants, and billing
 * records remain untouched while the optional launch mode is enabled.
 */
export function isFreeLaunchMode(): boolean {
  // VITE_FREE_LAUNCH_MODE is deliberately not secret and is also available to
  // Vercel server functions, allowing one deployment setting to control both.
  const value = (process.env.FREE_LAUNCH_MODE ?? process.env.VITE_FREE_LAUNCH_MODE)
    ?.trim()
    .toLowerCase();
  return value === 'true' || value === '1';
}

export const FREE_LAUNCH_CHECKOUT_MESSAGE =
  'ResuV is currently free during our launch offer. No payment is required.';

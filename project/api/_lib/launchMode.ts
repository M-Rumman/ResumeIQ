/**
 * Server-side counterpart to VITE_FREE_LAUNCH_MODE. Defaults to true so a
 * checkout can never be enabled accidentally. Lemon Squeezy configuration,
 * webhooks, variants, and billing records remain untouched.
 */
export function isFreeLaunchMode(): boolean {
  // VITE_FREE_LAUNCH_MODE is deliberately not secret and is also available to
  // Vercel server functions, allowing one deployment setting to control both.
  const value = (process.env.FREE_LAUNCH_MODE ?? process.env.VITE_FREE_LAUNCH_MODE)
    ?.trim()
    .toLowerCase();
  return value !== 'false' && value !== '0';
}

export const FREE_LAUNCH_CHECKOUT_MESSAGE =
  'ResuV is currently free during our launch offer. No payment is required.';

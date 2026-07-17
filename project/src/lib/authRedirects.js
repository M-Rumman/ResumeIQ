/** Production/site origin for auth email links (VITE_SITE_URL) with live-page fallback. */
export function getAppOrigin() {
  const fromEnv = String(import.meta.env.VITE_SITE_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) {
    return fromEnv.includes('://') ? fromEnv : `https://${fromEnv}`;
  }
  return window.location.origin.replace(/\/+$/, '');
}

/** Base URL for Supabase auth redirects — must match Supabase Dashboard → Auth → URL Configuration. */
export function getAuthRedirectUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppOrigin()}${normalizedPath}`;
}

export function isRedirectUrlError(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid path') ||
    lower.includes('redirect') ||
    lower.includes('not allowed') ||
    lower.includes('url configuration')
  );
}

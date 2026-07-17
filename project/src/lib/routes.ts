/** Public URL paths ↔ in-app page keys */

export const PUBLIC_PATHS = {
  home: '/',
  privacy: '/privacy',
  terms: '/terms',
  'refund-policy': '/refund-policy',
  contact: '/contact',
  about: '/about',
  pricing: '/pricing',
  login: '/login',
  signup: '/signup',
  'check-email': '/check-email',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
  'resume-analyzer': '/resume-analyzer',
  'resume-keyword-optimizer': '/resume-keyword-optimizer',
  'resume-score-checker': '/resume-score-checker',
  'resume-feedback': '/resume-feedback',
  'ai-interview-preparation': '/ai-interview-preparation',
  analyzer: '/analyzer',
  interview: '/interview',
  'interview-prep': '/interview-prep',
  dashboard: '/dashboard',
} as const;

export type RoutablePage = keyof typeof PUBLIC_PATHS;

const pathToPageMap = Object.fromEntries(
  Object.entries(PUBLIC_PATHS).map(([page, path]) => [path, page]),
) as Record<string, RoutablePage>;

/** Longest-path-first so `/` does not swallow other routes */
const sortedPaths = Object.entries(PUBLIC_PATHS).sort(
  (a, b) => b[1].length - a[1].length,
);

export function pathToPage(pathname: string): RoutablePage | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (pathToPageMap[normalized]) return pathToPageMap[normalized];

  for (const [page, path] of sortedPaths) {
    if (path !== '/' && normalized.startsWith(path)) {
      return page as RoutablePage;
    }
  }

  return normalized === '/' ? 'home' : null;
}

export function pageToPath(page: string): string {
  return PUBLIC_PATHS[page as RoutablePage] ?? '/';
}

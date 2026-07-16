/** Production SEO origin — never use localhost or preview domains for metadata. */
export const SEO_SITE_URL = 'https://resuv.app';

export const SEO_SITE_NAME = 'ResuV';

export const SEO_OG_IMAGE_PATH = '/og-image.png';

export const SEO_OG_IMAGE_URL = `${SEO_SITE_URL}${SEO_OG_IMAGE_PATH}`;

export const SEO_LOGO_URL = `${SEO_SITE_URL}/favicon.svg`;

export const SEO_DEFAULT_DESCRIPTION =
  'Optimize your resume with AI. Improve ATS compatibility, increase interview chances, receive personalized resume feedback and prepare for interviews.';

/** Public paths included in sitemap.xml (indexable marketing & auth entry pages). */
export const SITEMAP_PATHS = [
  '/',
  '/pricing',
  '/login',
  '/signup',
  '/forgot-password',
  '/privacy',
  '/terms',
  '/contact',
  '/resume-analyzer',
  '/resume-keyword-optimizer',
  '/resume-score-checker',
  '/resume-feedback',
  '/ai-interview-preparation',
] as const;

/** Paths that must not be indexed (robots meta + robots.txt disallow where applicable). */
export const NOINDEX_PAGE_KEYS = new Set([
  'dashboard',
  'analyzer',
  'interview',
  'interview-prep',
  'payment-success',
  'check-email',
  'reset-password',
]);

export function seoCanonicalUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/') return `${SEO_SITE_URL}/`;
  return `${SEO_SITE_URL}${normalized.replace(/\/+$/, '')}`;
}

/**
 * Generates sitemap.xml and robots.txt for production deployment.
 * Run automatically after `vite build` — outputs to dist/ (and public/ for local preview).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://resuv.app';

const SITEMAP_PATHS = [
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
];

function buildSitemapXml(): string {
  const urls = SITEMAP_PATHS.map((path) => {
    const loc = path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
    return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${path === '/' ? '1.0' : '0.8'}</priority>\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function buildRobotsTxt(): string {
  return `User-agent: *
Allow: /

Disallow: /dashboard
Disallow: /account
Disallow: /settings
Disallow: /api

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

function writeSeoFiles(outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'sitemap.xml'), buildSitemapXml(), 'utf8');
  writeFileSync(resolve(outDir, 'robots.txt'), buildRobotsTxt(), 'utf8');
  console.info(`[seo] Wrote sitemap.xml and robots.txt → ${outDir}`);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
writeSeoFiles(resolve(root, 'dist'));
writeSeoFiles(resolve(root, 'public'));

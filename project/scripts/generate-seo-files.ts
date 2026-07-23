/** Generates production sitemap.xml and robots.txt from shared route/blog data. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOG_ARTICLES } from '../src/lib/blogData.ts';

const SITE_URL = 'https://resuv.app';
const TODAY = new Date().toISOString().slice(0, 10);

type SitemapEntry = { path: string; lastmod: string; changefreq: 'weekly' | 'monthly' | 'yearly'; priority: string };

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: '/', lastmod: TODAY, changefreq: 'weekly', priority: '1.0' },
  { path: '/resume-analyzer', lastmod: TODAY, changefreq: 'weekly', priority: '0.9' },
  { path: '/resume-keyword-optimizer', lastmod: TODAY, changefreq: 'monthly', priority: '0.8' },
  { path: '/resume-score-checker', lastmod: TODAY, changefreq: 'monthly', priority: '0.8' },
  { path: '/resume-feedback', lastmod: TODAY, changefreq: 'monthly', priority: '0.8' },
  { path: '/ai-interview-preparation', lastmod: TODAY, changefreq: 'monthly', priority: '0.8' },
  { path: '/pricing', lastmod: TODAY, changefreq: 'monthly', priority: '0.7' },
  { path: '/login', lastmod: TODAY, changefreq: 'monthly', priority: '0.4' },
  { path: '/signup', lastmod: TODAY, changefreq: 'monthly', priority: '0.4' },
  { path: '/forgot-password', lastmod: TODAY, changefreq: 'yearly', priority: '0.2' },
  { path: '/blog', lastmod: TODAY, changefreq: 'weekly', priority: '0.8' },
  { path: '/about', lastmod: TODAY, changefreq: 'monthly', priority: '0.5' },
  { path: '/contact', lastmod: TODAY, changefreq: 'yearly', priority: '0.4' },
  { path: '/privacy', lastmod: TODAY, changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', lastmod: TODAY, changefreq: 'yearly', priority: '0.3' },
  { path: '/refund-policy', lastmod: TODAY, changefreq: 'yearly', priority: '0.3' },
];

function toIsoDate(value: string): string {
  const parsed = new Date(value.replace(/^(\w+)\s+(\d{4})$/, '$1 1, $2'));
  return Number.isNaN(parsed.getTime()) ? TODAY : parsed.toISOString().slice(0, 10);
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildSitemapXml(): string {
  const blogEntries: SitemapEntry[] = BLOG_ARTICLES.map((article) => ({
    path: `/blog/${article.slug}`,
    lastmod: toIsoDate(article.publishDate),
    changefreq: 'monthly',
    priority: '0.7',
  }));
  const urls = [...STATIC_ENTRIES, ...blogEntries].map((entry) => {
    const loc = entry.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${entry.path}`;
    return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function buildRobotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

function writeSeoFiles(outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'sitemap.xml'), buildSitemapXml(), 'utf8');
  writeFileSync(resolve(outDir, 'robots.txt'), buildRobotsTxt(), 'utf8');
  console.info(`[seo] Wrote sitemap.xml and robots.txt with ${BLOG_ARTICLES.length} blog articles → ${outDir}`);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
writeSeoFiles(resolve(root, 'dist'));
writeSeoFiles(resolve(root, 'public'));

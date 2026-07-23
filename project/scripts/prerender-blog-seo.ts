/**
 * Emits static HTML shells for the blog index and articles. Vite remains the
 * application runtime, while crawlers/social bots receive route-specific
 * canonical, social metadata and JSON-LD before executing JavaScript.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOG_ARTICLES, type BlogArticle } from '../src/lib/blogData.ts';
import { getPageSeo } from '../src/lib/seo/pageMeta.ts';
import { buildBlogArticleStructuredDataGraph, buildPageStructuredDataGraph, serializeStructuredDataGraph } from '../src/lib/seo/structuredData.ts';
import { seoCanonicalUrl } from '../src/lib/seo/config.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const template = readFileSync(resolve(dist, 'index.html'), 'utf8');

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function replaceMeta(html: string, selector: string, content: string): string {
  const expression = new RegExp(`(<meta\\s+${selector}\\s+content=")[^"]*("\\s*\\/?>)`, 'i');
  return html.replace(expression, `$1${escapeHtml(content)}$2`);
}

function render(html: string, values: { title: string; description: string; canonical: string; image: string; type: string; schema: Record<string, unknown>[] }): string {
  let output = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(values.title)}</title>`);
  output = replaceMeta(output, 'name="description"', values.description);
  output = output.replace(/(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/i, `$1${values.canonical}$2`);
  output = replaceMeta(output, 'property="og:title"', values.title);
  output = replaceMeta(output, 'property="og:description"', values.description);
  output = replaceMeta(output, 'property="og:url"', values.canonical);
  output = replaceMeta(output, 'property="og:image"', values.image);
  output = replaceMeta(output, 'property="og:type"', values.type);
  output = replaceMeta(output, 'name="twitter:title"', values.title);
  output = replaceMeta(output, 'name="twitter:description"', values.description);
  output = replaceMeta(output, 'name="twitter:image"', values.image);
  const jsonLd = `<script id="resuv-seo-page-jsonld" type="application/ld+json">${serializeStructuredDataGraph(values.schema)}</script>`;
  return output.replace('</head>', `    ${jsonLd}\n  </head>`);
}

function writeRoute(path: string, html: string): void {
  const output = resolve(dist, path, 'index.html');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html, 'utf8');
}

const blogMeta = getPageSeo('blog');
writeRoute('blog', render(template, {
  title: blogMeta.title,
  description: blogMeta.description,
  canonical: seoCanonicalUrl('/blog'),
  image: 'https://resuv.app/why-resuv-resume.png',
  type: 'website',
  schema: buildPageStructuredDataGraph('blog', blogMeta),
}));

for (const article of BLOG_ARTICLES) {
  writeRoute(`blog/${article.slug}`, render(template, {
    title: article.metaTitle,
    description: article.metaDescription,
    canonical: seoCanonicalUrl(`/blog/${article.slug}`),
    image: article.coverImage,
    type: 'article',
    schema: buildBlogArticleStructuredDataGraph(article),
  }));
}

console.info(`[seo] Prerendered ${BLOG_ARTICLES.length} blog article SEO shells.`);

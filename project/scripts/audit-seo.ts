/** Lightweight, repeatable SEO contract audit for local and CI validation. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOG_ARTICLES } from '../src/lib/blogData.ts';
import { buildBlogArticleStructuredDataGraph, serializeStructuredDataGraph } from '../src/lib/seo/structuredData.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');
const robots = readFileSync(resolve(root, 'public/robots.txt'), 'utf8');

assert.ok(existsSync(resolve(root, 'public/why-resuv-resume.png')), 'Missing fallback Open Graph image asset');

assert.match(robots, /^User-agent: \*\r?\nAllow: \/$/m);
assert.match(robots, /Sitemap: https:\/\/resuv\.app\/sitemap\.xml/);
assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
assert.match(sitemap, /<changefreq>(weekly|monthly|yearly)<\/changefreq>/);
assert.match(sitemap, /<priority>\d\.\d<\/priority>/);

const titles = new Set<string>();
const descriptions = new Set<string>();
for (const article of BLOG_ARTICLES) {
  assert.ok(article.slug && article.metaTitle && article.metaDescription && article.coverImage, `Missing SEO data for ${article.slug}`);
  assert.ok(!titles.has(article.metaTitle), `Duplicate article meta title: ${article.metaTitle}`);
  assert.ok(!descriptions.has(article.metaDescription), `Duplicate article meta description: ${article.metaDescription}`);
  titles.add(article.metaTitle);
  descriptions.add(article.metaDescription);
  assert.match(sitemap, new RegExp(`https://resuv\\.app/blog/${article.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  const schema = JSON.parse(serializeStructuredDataGraph(buildBlogArticleStructuredDataGraph(article)));
  const posting = schema['@graph'].find((entry: Record<string, unknown>) => entry['@type'] === 'BlogPosting');
  assert.ok(posting && posting.headline === article.title && posting.mainEntityOfPage, `Invalid BlogPosting schema for ${article.slug}`);
  const prerendered = readFileSync(resolve(root, `dist/blog/${article.slug}/index.html`), 'utf8');
  assert.match(prerendered, new RegExp(`<link rel="canonical" href="https://resuv\\.app/blog/${article.slug}"`));
  assert.match(prerendered, /"@type":"BlogPosting"/);
}

console.info(`[seo] Audit passed: ${BLOG_ARTICLES.length} articles, dynamic sitemap, robots, and BlogPosting schemas validated.`);

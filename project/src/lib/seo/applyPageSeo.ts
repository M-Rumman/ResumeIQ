import { seoCanonicalUrl } from './config.js';
import { getOpenGraphPayload, getTwitterPayload, type PageSeoMeta } from './pageMeta.js';
import type { BlogArticle } from '../blogData.js';
import {
  buildBlogArticleStructuredDataGraph,
  buildPageStructuredDataGraph,
  serializeStructuredDataGraph,
} from './structuredData.js';

const MANAGED_SELECTOR = '[data-seo-managed]';
const PAGE_JSONLD_ID = 'resuv-seo-page-jsonld';

/**
 * The declarative metadata contract used by the reusable SEO component.
 * `openGraphTitle` is useful when a concise social title differs from the
 * document title, such as for a blog article.
 */
export interface SeoMetadata extends PageSeoMeta {
  openGraphTitle?: string;
  openGraphType?: 'website' | 'article';
}

function upsertMeta(
  attribute: 'name' | 'property',
  key: string,
  content: string,
): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]${MANAGED_SELECTOR}`,
  );

  if (!el) {
    el = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  }

  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, key);
    el.setAttribute('data-seo-managed', 'true');
    document.head.appendChild(el);
  } else {
    el.setAttribute('data-seo-managed', 'true');
  }

  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]${MANAGED_SELECTOR}`);

  if (!el) {
    el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  }

  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    el.setAttribute('data-seo-managed', 'true');
    document.head.appendChild(el);
  } else {
    el.setAttribute('data-seo-managed', 'true');
  }

  el.setAttribute('href', href);
}

export function applyStructuredDataGraph(graph: Record<string, unknown>[]): void {
  const existing = document.getElementById(PAGE_JSONLD_ID);

  if (graph.length === 0) {
    existing?.remove();
    return;
  }

  const script = (existing ?? document.createElement('script')) as HTMLScriptElement;
  script.id = PAGE_JSONLD_ID;
  script.type = 'application/ld+json';
  script.setAttribute('data-seo-managed', 'true');
  script.textContent = serializeStructuredDataGraph(graph);

  if (!existing) {
    document.head.appendChild(script);
  }
}

/** Applies all head metadata from one object, with optional JSON-LD. */
export function applySeoMetadata(
  meta: SeoMetadata,
  structuredData: Record<string, unknown>[] = [],
): void {
  document.title = meta.title;

  const canonical = seoCanonicalUrl(meta.canonicalPath);
  const og = getOpenGraphPayload(meta);
  const twitter = getTwitterPayload(meta);
  const socialTitle = meta.openGraphTitle ?? og.title;
  const socialType = meta.openGraphType ?? og.type;

  upsertMeta('name', 'description', meta.description);
  upsertLink('canonical', canonical);

  if (meta.noindex) {
    upsertMeta('name', 'robots', 'noindex, follow');
  } else {
    upsertMeta('name', 'robots', 'index, follow');
  }

  upsertMeta('property', 'og:title', socialTitle);
  upsertMeta('property', 'og:description', og.description);
  upsertMeta('property', 'og:url', og.url);
  upsertMeta('property', 'og:image', og.image);
  upsertMeta('property', 'og:type', socialType);
  upsertMeta('property', 'og:site_name', og.siteName);

  upsertMeta('name', 'twitter:card', twitter.card);
  upsertMeta('name', 'twitter:title', meta.openGraphTitle ?? twitter.title);
  upsertMeta('name', 'twitter:description', twitter.description);
  upsertMeta('name', 'twitter:image', twitter.image);

  applyStructuredDataGraph(structuredData);
}

export function applyPageSeo(page: string, meta: PageSeoMeta): void {
  applySeoMetadata(meta, buildPageStructuredDataGraph(page, meta));
}

/** Applies unique metadata, canonical and BlogPosting JSON-LD for one article. */
export function applyBlogArticleSeo(article: BlogArticle): void {
  const meta: SeoMetadata = {
    title: article.metaTitle,
    description: article.metaDescription,
    canonicalPath: `/blog/${article.slug}`,
    noindex: false,
    image: article.coverImage,
    openGraphTitle: article.title,
    openGraphType: 'article',
  };
  applySeoMetadata(meta, buildBlogArticleStructuredDataGraph(article));
}

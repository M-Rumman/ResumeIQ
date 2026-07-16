import { seoCanonicalUrl } from './config.js';
import { getOpenGraphPayload, getTwitterPayload, type PageSeoMeta } from './pageMeta.js';
import {
  buildPageStructuredDataGraph,
  serializeStructuredDataGraph,
} from './structuredData.js';

const MANAGED_SELECTOR = '[data-seo-managed]';
const PAGE_JSONLD_ID = 'resuv-seo-page-jsonld';

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

function applyPageStructuredData(page: string, meta: PageSeoMeta): void {
  const graph = buildPageStructuredDataGraph(page, meta);
  const existing = document.getElementById(PAGE_JSONLD_ID);

  if (graph.length === 0) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement('script');
  script.id = PAGE_JSONLD_ID;
  script.type = 'application/ld+json';
  script.setAttribute('data-seo-managed', 'true');
  script.textContent = serializeStructuredDataGraph(graph);

  if (!existing) {
    document.head.appendChild(script);
  }
}

export function applyPageSeo(page: string, meta: PageSeoMeta): void {
  document.title = meta.title;

  const canonical = seoCanonicalUrl(meta.canonicalPath);
  const og = getOpenGraphPayload(meta);
  const twitter = getTwitterPayload(meta);

  upsertMeta('name', 'description', meta.description);
  upsertLink('canonical', canonical);

  if (meta.noindex) {
    upsertMeta('name', 'robots', 'noindex, nofollow');
  } else {
    upsertMeta('name', 'robots', 'index, follow');
  }

  upsertMeta('property', 'og:title', og.title);
  upsertMeta('property', 'og:description', og.description);
  upsertMeta('property', 'og:url', og.url);
  upsertMeta('property', 'og:image', og.image);
  upsertMeta('property', 'og:type', og.type);
  upsertMeta('property', 'og:site_name', og.siteName);

  upsertMeta('name', 'twitter:card', twitter.card);
  upsertMeta('name', 'twitter:title', twitter.title);
  upsertMeta('name', 'twitter:description', twitter.description);
  upsertMeta('name', 'twitter:image', twitter.image);

  applyPageStructuredData(page, meta);
}

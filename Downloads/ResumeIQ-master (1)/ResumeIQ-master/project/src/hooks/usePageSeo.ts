import { useEffect } from 'react';
import { applyPageSeo } from '../lib/seo/applyPageSeo.js';
import { getPageSeo } from '../lib/seo/pageMeta.js';

/** Updates document title, meta tags, canonical URL, OG/Twitter, and JSON-LD for the active page. */
export function usePageSeo(page: string): void {
  useEffect(() => {
    const meta = getPageSeo(page);
    applyPageSeo(page, meta);
  }, [page]);
}

import { useEffect } from 'react';
import { applySeoMetadata, type SeoMetadata } from '../lib/seo/applyPageSeo';

export interface SEOProps {
  /** Page-specific document, canonical and social metadata. */
  metadata: SeoMetadata;
  /** Optional Schema.org JSON-LD objects for rich results. */
  structuredData?: Record<string, unknown>[];
}

/**
 * A non-visual, declarative way for any page to own its SEO head tags.
 *
 * @example
 * <SEO metadata={{ title: 'Pricing | ResuV', description: '...', canonicalPath: '/pricing' }} />
 */
export default function SEO({ metadata, structuredData = [] }: SEOProps) {
  useEffect(() => {
    applySeoMetadata(metadata, structuredData);
  }, [metadata, structuredData]);

  return null;
}

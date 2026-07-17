/**
 * Emits static global JSON-LD for index.html at build time.
 * Keeps Organization / WebSite / SoftwareApplication in sync with src/lib/seo/structuredData.ts
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPPORT_EMAIL = 'resuvhome@gmail.com';
const SEO_SITE_URL = 'https://resuv.app';
const SEO_SITE_NAME = 'ResuV';
const SEO_LOGO_URL = `${SEO_SITE_URL}/favicon.svg`;
const SEO_OG_IMAGE_URL = `${SEO_SITE_URL}/og-image.png`;
const SEO_DEFAULT_DESCRIPTION =
  'Optimize your resume with AI. Improve ATS compatibility, increase interview chances, receive personalized resume feedback and prepare for interviews.';

const ORGANIZATION_ID = `${SEO_SITE_URL}/#organization`;
const WEBSITE_ID = `${SEO_SITE_URL}/#website`;
const SOFTWARE_APPLICATION_ID = `${SEO_SITE_URL}/#softwareapplication`;

const globalGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SEO_SITE_NAME,
      url: SEO_SITE_URL,
      logo: SEO_LOGO_URL,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SUPPORT_EMAIL,
        availableLanguage: 'English',
      },
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: SEO_SITE_NAME,
      url: SEO_SITE_URL,
      description: SEO_DEFAULT_DESCRIPTION,
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': SOFTWARE_APPLICATION_ID,
      name: SEO_SITE_NAME,
      url: SEO_SITE_URL,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: SEO_DEFAULT_DESCRIPTION,
      image: SEO_OG_IMAGE_URL,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      provider: { '@id': ORGANIZATION_ID },
    },
  ],
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = resolve(root, 'index.html');
const json = JSON.stringify(globalGraph, null, 2);
const html = readFileSync(indexPath, 'utf8');

const markerStart = '<!-- SEO_GLOBAL_JSONLD -->';
const markerEnd = '<!-- /SEO_GLOBAL_JSONLD -->';
const block = `${markerStart}\n    <script type="application/ld+json">\n${json}\n    </script>\n    ${markerEnd}`;

let nextHtml: string;
if (html.includes(markerStart)) {
  nextHtml = html.replace(
    new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`),
    block.trimEnd(),
  );
} else {
  nextHtml = html.replace(
    '</head>',
    `    ${block}\n  </head>`,
  );
}

writeFileSync(indexPath, nextHtml, 'utf8');
console.info('[seo] Updated global JSON-LD in index.html');

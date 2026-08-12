import { useEffect } from 'react';

const SITE_URL = 'https://art-moment.com';
const DEFAULT_IMAGE = `${SITE_URL}/pwa-512x512.png`;

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

function upsertLink(rel, href, hreflang) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    if (hreflang) element.hreflang = hreflang;
    document.head.appendChild(element);
  }
  element.href = href;
}

export default function SeoHead({
  title,
  description,
  path = '/',
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  structuredData = [],
}) {
  useEffect(() => {
    const canonicalUrl = new URL(path, SITE_URL).toString();
    const absoluteImage = new URL(image || DEFAULT_IMAGE, SITE_URL).toString();
    document.title = title;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: absoluteImage });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: absoluteImage });
    upsertLink('canonical', canonicalUrl);
    upsertLink('alternate', canonicalUrl, 'ar');
    upsertLink('alternate', canonicalUrl, 'en');
    upsertLink('alternate', canonicalUrl, 'x-default');

    const nodes = Array.isArray(structuredData) ? structuredData.filter(Boolean) : [structuredData].filter(Boolean);
    const scriptId = 'art-moment-page-jsonld';
    document.getElementById(scriptId)?.remove();
    if (nodes.length > 0) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.text = JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
      document.head.appendChild(script);
    }

    return () => document.getElementById(scriptId)?.remove();
  }, [description, image, noindex, path, structuredData, title, type]);

  return null;
}

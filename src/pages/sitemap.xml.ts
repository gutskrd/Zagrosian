import type { APIRoute } from 'astro';
import { textPages } from '../lib/pages';

/**
 * Sitemap of every indexable page in every locale. Each entry lists all its language alternates
 * (hreflang) so search engines serve the right one. 404 pages are `noindex` and excluded.
 */
export const GET: APIRoute = async () => {
  const pages = await textPages();

  const urls = pages
    .map((page) => {
      const versions = pages.filter((other) => other.slug === page.slug);
      const english = versions.find((other) => other.locale === 'en')!;
      const alternates = [
        ...versions.map((other) => `<xhtml:link rel="alternate" hreflang="${other.locale}" href="${other.url}"/>`),
        `<xhtml:link rel="alternate" hreflang="x-default" href="${english.url}"/>`,
      ];
      const lastmod = page.updated ? `<lastmod>${page.updated}</lastmod>` : '';
      return `  <url><loc>${page.url}</loc>${lastmod}\n    ${alternates.join('\n    ')}\n  </url>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

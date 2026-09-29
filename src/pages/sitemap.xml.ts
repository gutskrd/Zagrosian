import type { APIRoute } from 'astro';
import { textPages } from '../lib/pages';

/**
 * Every indexable page in every language. Each entry lists all of its language
 * versions (hreflang), so search engines show visitors the right one. The 404
 * pages are `noindex` and left out.
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

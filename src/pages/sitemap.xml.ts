import type { APIRoute } from 'astro';
import { textPages } from '../lib/pages';

/** Every indexable page, with the date legal pages last changed. The 404 page is `noindex` and left out. */
export const GET: APIRoute = () => {
  const urls = textPages
    .map(({ url, updated }) => `  <url><loc>${url}</loc>${updated ? `<lastmod>${updated}</lastmod>` : ''}</url>`)
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

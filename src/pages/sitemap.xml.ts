import type { APIRoute } from 'astro';
import { site } from '../site';

/** Indexable pages only; placeholder and error pages are `noindex`. */
const paths = ['/'];

export const GET: APIRoute = () => {
  const urls = paths.map((path) => `  <url><loc>${new URL(path, site.url).href}</loc></url>`).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

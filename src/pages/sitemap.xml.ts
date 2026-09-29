import type { APIRoute, MarkdownInstance } from 'astro';
import { site } from '../site';

/** The legal pages, whose `updated` date becomes their <lastmod>. */
const legalPages = import.meta.glob<MarkdownInstance<{ updated: string | Date }>>('./*.md', { eager: true });

/** Every indexable page. The 404 page is `noindex` and left out. */
const pages: { path: string; lastmod?: string }[] = [
  { path: '/' },
  ...Object.entries(legalPages).map(([file, page]) => ({
    path: `/${file.slice(2, -'.md'.length)}`,
    lastmod: new Date(page.frontmatter.updated).toISOString().slice(0, 10),
  })),
];

export const GET: APIRoute = () => {
  const urls = pages
    .map(({ path, lastmod }) => {
      const loc = `<loc>${new URL(path, site.url).href}</loc>`;
      return `  <url>${loc}${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    })
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

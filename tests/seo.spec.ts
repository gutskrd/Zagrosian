/**
 * What search engines and AI crawlers read: every built page has a title, a
 * description, a canonical address, its other languages, one main heading and
 * valid structured data; the 404 page is kept out of the index; the sitemap
 * lists every page.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { locales, pages } from './support';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const built = readdirSync(dist, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.html'));

test('every page is built, and the sitemap lists every page', () => {
  // Every page in every language, and a 404 page in every language.
  expect(built.length).toBe(pages.length + locales.length);
  const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  expect(sitemap.match(/<loc>/g)?.length).toBe(pages.length);
});

test('the tab icon is black on a light browser and white on a dark one', async ({ page }) => {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const icons = [...html.matchAll(/<link rel="icon"[^>]*>/g)].map(([link]) => link);
  // Declared 16 by 16, the black-only ICO is an exact fit, and Chrome takes it
  // over the SVG: a dark tab strip then shows the black logo.
  expect(icons.find((link) => link.includes('/favicon.ico'))).toContain('sizes="32x32"');
  expect(icons.find((link) => link.includes('/favicon.svg'))).toContain('type="image/svg+xml"');
  expect(icons.find((link) => link.includes('/favicon-96-dark.png'))).toContain('media="(prefers-color-scheme: dark)"');

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/favicon.svg');
    const shown = await page.evaluate(() =>
      [...document.querySelectorAll('path')].filter((path) => getComputedStyle(path).display !== 'none').map((path) => path.getAttribute('fill')),
    );
    expect(shown, colorScheme).toEqual([colorScheme === 'dark' ? '#fff' : '#000']);
  }
});

test('the book is described as a book, with its PDF, its chapters and its pages', () => {
  const book = JSON.parse(readFileSync(new URL('../src/assets/book/book.json', import.meta.url), 'utf8'));
  for (const file of ['book.html', 'de/book.html', 'ar/book.html']) {
    const html = readFileSync(join(dist, file), 'utf8');
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '{}';
    type Node = { '@type': string; '@id'?: string; numberOfPages?: number; encoding?: object; hasPart?: object[]; mainEntity?: object };
    const graph = (JSON.parse(json) as { '@graph': Node[] })['@graph'];
    const node = graph.find((item) => item['@type'] === 'Book');
    expect(node, file).toBeDefined();
    expect(node!.numberOfPages).toBe(book.pageCount);
    expect(node!.encoding).toMatchObject({ '@type': 'MediaObject', encodingFormat: 'application/pdf', contentUrl: 'https://zagrosian.com/book/reya-kurmanci.pdf' });
    expect(node!.hasPart).toHaveLength(book.chapters.length);
    expect(node!.hasPart![0]).toMatchObject({ '@type': 'Chapter', position: 1, pageStart: book.chapters[0].start, pageEnd: book.chapters[0].end });
    const webPage = graph.find((item) => item['@type'] === 'WebPage')!;
    expect(webPage.mainEntity).toEqual({ '@id': node!['@id'] });
    expect(html).toContain('<meta property="og:image" content="https://zagrosian.com/og/book.jpg"');
    expect(html).toContain('<meta property="og:image:type" content="image/jpeg"');
  }
});

for (const file of built) {
  test(`metadata: ${file}`, () => {
    const html = readFileSync(join(dist, file), 'utf8');
    const notFound = file.includes('404');
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';

    expect(html, 'the language').toMatch(/<html[^>]* lang="[^"]+"/);
    expect([...title].length, `title "${title}"`).toBeGreaterThan(0);
    expect([...title].length, `title "${title}"`).toBeLessThanOrEqual(70);
    expect([...description].length, 'description').toBeGreaterThan(0);
    expect([...description].length, 'description').toBeLessThanOrEqual(170);
    expect(html.match(/<h1[\s>]/g)?.length, 'main headings').toBe(1);
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      expect(() => JSON.parse(json), 'structured data').not.toThrow();
    }

    if (notFound) {
      expect(robots, 'a 404 page is never indexed').toContain('noindex');
    } else {
      expect(robots).not.toContain('noindex');
      expect(html, 'the canonical address').toMatch(/<link rel="canonical" href="https:\/\/[^"]+"/);
      // Every language, and x-default.
      expect(html.match(/hreflang="/g)?.length ?? 0, 'alternate languages').toBeGreaterThanOrEqual(locales.length + 1);
    }
  });
}

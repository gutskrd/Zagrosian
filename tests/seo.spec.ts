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

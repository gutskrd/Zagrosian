/**
 * The site's security headers, as public/_headers sets them, and that nothing
 * on any page breaks its Content-Security-Policy or logs an error.
 */
import { expect, test } from '@playwright/test';
import { locales, pagesIn, scrollThrough, settled, watch } from './support';

test('the security headers', async ({ request }) => {
  const response = await request.get('/');
  const headers = response.headers();
  const policy = headers['content-security-policy'] ?? '';
  expect(policy).toContain("default-src 'none'");
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("require-trusted-types-for 'script'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toContain('unsafe-inline');
  expect(policy).not.toContain('unsafe-eval');
  expect(headers['strict-transport-security']).toMatch(/max-age=\d{8,}; includeSubDomains; preload/);
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

// Over plain http the page's own policy would refuse its styles, fonts and
// scripts (they are upgraded to https, a different origin), so a first visit
// over http would show bare HTML. The Worker in front of the site
// (worker/index.ts) sends every such request to https on the same host first
// (as the HSTS preload list asks), and www to the bare domain. (wrangler dev
// rewrites the scheme of a redirect to its own, so the Worker is also called
// directly here.)
test('http and www are sent to https://zagrosian.com', async ({ request }) => {
  const { default: worker } = await import('../worker/index.ts');
  const env = { ASSETS: { fetch: async () => new Response('page') } };
  const visit = async (url: string, method = 'GET') => {
    const response = await worker.fetch(new Request(url, { method }), env);
    return [response.status, response.headers.get('location')];
  };
  expect(await visit('http://zagrosian.com/de/privacy?ref=qr')).toEqual([301, 'https://zagrosian.com/de/privacy?ref=qr']);
  expect(await visit('http://www.zagrosian.com/fa')).toEqual([301, 'https://www.zagrosian.com/fa']);
  expect(await visit('https://www.zagrosian.com/')).toEqual([301, 'https://zagrosian.com/']);
  expect(await visit('http://zagrosian.com/', 'POST')).toEqual([308, 'https://zagrosian.com/']);
  expect(await visit('https://zagrosian.com/')).toEqual([200, null]);

  // Through the server: the redirect happens before any page is served.
  const www = await request.get('/', { headers: { host: 'www.zagrosian.com' }, maxRedirects: 0 });
  expect(www.status()).toBe(301);
  expect(www.headers()['location']).toMatch(/^https?:\/\/www\.zagrosian\.com\/$/);
});

test('security.txt never expires between builds', async () => {
  const { default: worker } = await import('../worker/index.ts');
  const built = 'Contact: mailto:contact@zagrosian.com\nExpires: 2020-01-01T00:00:00.000Z\n';
  const env = { ASSETS: { fetch: async () => new Response(built, { headers: { 'Content-Type': 'text/plain' } }) } };
  const response = await worker.fetch(new Request('https://zagrosian.com/.well-known/security.txt'), env);
  const expires = new Date((await response.text()).match(/^Expires: (.*)$/m)?.[1] ?? 0).getTime();
  const days = (expires - Date.now()) / 864e5;
  expect(days).toBeGreaterThan(178);
  expect(days).toBeLessThan(366);
  expect(response.headers.get('content-type')).toBe('text/plain');
});

test('a page in another language says so', async ({ request }) => {
  expect((await request.get('/de')).headers()['content-language']).toBe('de');
});

for (const { code } of locales) {
  test(`no policy violations or errors on any page: ${code}`, async ({ page }) => {
    await settled(page.context());
    const problems = await watch(page);
    for (const path of pagesIn(code)) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await scrollThrough(page);
    }
    expect(problems).toEqual([]);
  });
}

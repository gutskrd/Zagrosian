/** Security headers (public/_headers), and no CSP violations or console errors on any page. */
import { expect, test } from '@playwright/test';
import { locales, pagesIn, scrollThrough, settled, watch } from './support';

test('sends the security headers', async ({ request }) => {
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

// Over plain HTTP the page's own CSP would block its styles, fonts and scripts (upgraded to HTTPS,
// a different origin), so a first visit would render bare HTML. The Worker (worker/index.ts)
// redirects to HTTPS on the same host first (as the HSTS preload list requires), then www to the
// apex. (wrangler dev rewrites redirect schemes to its own, so the Worker is also called directly
// here.)
test('redirects HTTP and www to https://zagrosian.com', async ({ request }) => {
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

test('keeps security.txt from expiring between builds', async () => {
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

test('sends Content-Language for localized pages', async ({ request }) => {
  expect((await request.get('/de')).headers()['content-language']).toBe('de');
});

// Arbitrary fragments can be linked to; an invalid percent-encoding (`#%`) once threw before the
// menu, theme and search were initialized.
test('tolerates malformed URL fragments', async ({ page }) => {
  await settled(page.context());
  const problems = await watch(page);
  for (const path of ['/#%', '/privacy#%zz', '/de#%E0%A4']) {
    await page.goto(path, { waitUntil: 'networkidle' });
  }
  expect(problems).toEqual([]);
});

for (const { code } of locales) {
  test(`no CSP violations or console errors: ${code}`, async ({ page }) => {
    await settled(page.context());
    const problems = await watch(page);
    for (const path of pagesIn(code)) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await scrollThrough(page);
    }
    expect(problems).toEqual([]);
  });
}

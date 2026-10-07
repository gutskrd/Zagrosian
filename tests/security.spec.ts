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

/**
 * The loading screen (Loader.astro, loader.ts): it shows when a visit starts
 * or the page is reloaded, lifts by itself, lets the visitor in at a click,
 * and never shows on the way from page to page, nor with reduced motion.
 */
import { type Page, expect, test } from '@playwright/test';

/** With a language chosen and sound off, but as at the start of a visit. */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('language-chosen', '1');
      localStorage.setItem('sound', 'off');
    } catch {
      // Storage can be unavailable.
    }
  });
});

const loading = (page: Page) => page.evaluate(() => document.documentElement.dataset.loading ?? null);

/** Every request for the animation (not its first frame, a 4 kB still). */
function countAnimationRequests(page: Page) {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/zagrosian-loader\.[\w-]+\.webp/.test(request.url())) requests.push(request.url());
  });
  return requests;
}

test('it shows when a visit starts and lifts by itself, but not on the next page', async ({ page }) => {
  const requests = countAnimationRequests(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await loading(page)).toBe('on');
  await expect(page.locator('.loader')).toBeVisible();
  // The animation plays once (3 s), and the screen lifts four seconds after
  // the page started at the latest; 8 s is the stylesheet's own failsafe.
  await expect.poll(() => loading(page), { timeout: 8000 }).toBeNull();
  expect(requests.length).toBeGreaterThan(0);

  requests.length = 0;
  await page.goto('/privacy');
  expect(await loading(page)).toBeNull();
  expect(requests).toEqual([]);
});

test('it shows again on reload, and a click lets the visitor straight in', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => loading(page), { timeout: 8000 }).toBeNull();
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await loading(page)).toBe('on');
  await page.waitForTimeout(300);
  await page.mouse.click(10, 400);
  // It fades for half a second, then is gone.
  await expect.poll(() => loading(page), { timeout: 1500 }).toBeNull();
});

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('it never shows, and the animation is never downloaded', async ({ page }) => {
    const requests = countAnimationRequests(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(await loading(page)).toBeNull();
    await expect(page.locator('.loader')).toBeHidden();
    expect(requests).toEqual([]);
  });
});

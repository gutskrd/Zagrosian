/**
 * The controls a visitor uses: the language menu, the language suggestion,
 * the site menu on a phone, and the theme.
 */
import { expect, test } from '@playwright/test';

/** As on a later page of a visit, so the loading screen does not show. */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('loaded', '1');
      localStorage.setItem('sound', 'off');
    } catch {
      // Storage can be unavailable.
    }
  });
});

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });

  test('the language menu changes the language, and the theme is kept', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // A German browser is offered the German site.
    await expect(page.locator('.suggest__card[data-locale="de"]')).toBeVisible();

    await page.locator('.language__button').click();
    await expect(page.locator('#language-menu')).toBeVisible();
    await page.locator('#language-menu a[hreflang="ar"]').click();
    await page.waitForURL('**/ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // A language chosen is never suggested against.
    await page.waitForTimeout(1200);
    await expect(page.locator('.suggest')).toBeHidden();

    const theme = await page.locator('html').getAttribute('data-theme');
    const other = theme === 'dark' ? 'light' : 'dark';
    await page.locator('[data-theme-toggle]:visible').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', other);
    await page.goto('/ar/privacy');
    await expect(page.locator('html')).toHaveAttribute('data-theme', other);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.describe('in Turkish', () => {
    test.use({ locale: 'tr-TR' });

    test('accepting the suggestion goes to the same page in that language', async ({ page }) => {
      await page.goto('/privacy', { waitUntil: 'networkidle' });
      await page.locator('.suggest__card[data-locale="tr"] .suggest__link').click();
      await page.waitForURL('**/tr/privacy');
      expect(await page.evaluate(() => localStorage.getItem('language-chosen'))).not.toBeNull();
    });
  });

  test.describe('in Sorani', () => {
    test.use({ locale: 'ckb-IQ' });

    test('a dismissed suggestion stays dismissed; the menu changes the language', async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      const card = page.locator('.suggest__card[data-locale="ckb"]');
      await expect(card).toBeVisible();
      await card.locator('[data-language-suggestion-dismiss]').click();
      await expect(page.locator('.suggest')).toBeHidden();
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await expect(page.locator('.suggest')).toBeHidden();

      await page.locator('.menu-button--open').click();
      await expect(page.locator('#site-menu')).toBeVisible();
      await page.locator('.site-menu__languages a[hreflang="ku"]').click();
      await page.waitForURL('**/ku');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ku');
    });
  });
});

/**
 * The controls a visitor uses: the language menu, the language suggestion,
 * the site menu on a phone, the theme, Share, and the word of the day.
 */
import { expect, test } from '@playwright/test';
import { dayNumber, wordIndex, words } from '../src/lib/words';

/** With sound off. */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
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
    // The theme is a setting in the site menu.
    await page.locator('.menu-button--open').click();
    await page.locator(`#site-menu [data-theme-switch] label[data-value="${other}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', other);
    await page.goto('/ar/privacy');
    await expect(page.locator('html')).toHaveAttribute('data-theme', other);
  });
});

test.describe('in the menu and with Hevalo', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Share copies the page’s own address where there is no share sheet', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await context.addInitScript(() => {
      // As in a browser without a share sheet (desktop Firefox).
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.goto('/de/privacy', { waitUntil: 'networkidle' });
    await page.locator('.menu-button--open').click();
    const share = page.locator('#site-menu [data-share]');
    await expect(share).toHaveText('Diese Seite teilen');
    await share.click();
    await expect(share).toHaveText('Link kopiert');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://zagrosian.com/de/privacy');
  });

  for (const [path, main, other] of [
    ['/', 'ku', 'ckb'],
    ['/ckb', 'ckb', 'ku'],
    ['/ku', 'ku', 'ckb'],
  ] as const) {
    test(`the word of the day is the visitor’s day’s: ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const today = await page.evaluate(() => {
        const now = new Date();
        return [now.getFullYear(), now.getMonth(), now.getDate()] as const;
      });
      const word = words[wordIndex(dayNumber(...today))]!;
      const card = page.locator('[data-word]');
      await expect(card.locator('[data-word-main]')).toHaveText(word[main]);
      await expect(card.locator('[data-word-other]')).toHaveText(word[other]);
      if (path === '/') await expect(card.locator('[data-word-meaning]')).toHaveText(word.meaning.en);
      else await expect(card.locator('[data-word-meaning]')).toHaveCount(0);
    });
  }
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

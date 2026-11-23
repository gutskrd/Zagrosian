/**
 * User-facing controls: the language menu, language suggestion, mobile site menu, theme and Share.
 */
import { expect, test } from '@playwright/test';

/** Sound off. */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('sound', 'off');
    } catch {
      // Storage may be unavailable.
    }
  });
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });

  test('switches language from the language menu and keeps the theme', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // A German browser is offered the German site.
    await expect(page.locator('.suggest__card[data-locale="de"]')).toBeVisible();

    await page.locator('.language__button').click();
    await expect(page.locator('#language-menu')).toBeVisible();
    await page.locator('#language-menu a[hreflang="ar"]').click();
    await page.waitForURL('**/ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // An explicitly chosen language is never overridden by a suggestion.
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

test.describe('site menu', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Share copies the canonical URL without the Web Share API', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await context.addInitScript(() => {
      // Simulates a browser without a native share sheet (desktop Firefox).
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
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.describe('Turkish', () => {
    test.use({ locale: 'tr-TR' });

    test('accepting the language suggestion opens the same page in that language', async ({ page }) => {
      await page.goto('/privacy', { waitUntil: 'networkidle' });
      await page.locator('.suggest__card[data-locale="tr"] .suggest__link').click();
      await page.waitForURL('**/tr/privacy');
      expect(await page.evaluate(() => localStorage.getItem('language-chosen'))).not.toBeNull();
    });
  });

  test.describe('Sorani', () => {
    test.use({ locale: 'ckb-IQ' });

    test('remembers a dismissed suggestion and switches language from the menu', async ({ page }) => {
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

test.describe('section links', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  /** Distance from the section's top to the header's bottom, in whole pixels. */
  const offset = (page: import('@playwright/test').Page, id: string) =>
    page.evaluate((target) => {
      const header = document.querySelector<HTMLElement>('[data-site-header]')!.offsetHeight;
      return Math.abs(Math.round(document.getElementById(target)!.getBoundingClientRect().top - header));
    }, id);

  test('land on the section once the page settles when opened directly', async ({ page }) => {
    await page.goto('/#about', { waitUntil: 'load' });
    await expect.poll(() => offset(page, 'about'), { timeout: 6000 }).toBeLessThanOrEqual(1);
  });

  test('land on the section when followed from another page', async ({ page }) => {
    await page.goto('/privacy', { waitUntil: 'load' });
    await page.locator('.site-footer a[href="/#faq"]').click();
    await page.waitForURL('**/#faq');
    await expect.poll(() => offset(page, 'faq'), { timeout: 6000 }).toBeLessThanOrEqual(1);
  });
});

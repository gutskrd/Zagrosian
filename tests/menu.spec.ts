/**
 * The site menu is in the page's own colours, in either theme, also when it is
 * opened from the header while that is in the other theme's colours over the
 * story's scene; Escape closes it.
 */
import { expect, test } from '@playwright/test';
import { settled } from './support';

const paper = { light: 'rgb(255, 255, 255)', dark: 'rgb(10, 10, 10)' };

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    test('the menu is in the theme’s colours, and Escape closes it', async ({ page }) => {
      await settled(page.context());
      await page.goto('/', { waitUntil: 'networkidle' });
      const menu = page.locator('#site-menu');
      await page.locator('.menu-button--open').click();
      await expect(menu).toBeVisible();
      await expect(menu).toHaveCSS('background-color', paper[colorScheme]);
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    });
  });
}

test('opened over the story’s scene, the menu keeps the page’s colours', async ({ page }) => {
  await settled(page.context());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/', { waitUntil: 'networkidle' });
  const header = page.locator('.site-header');
  // Down into the story, until the header is drawn in the other colours.
  await expect
    .poll(
      async () => {
        await page.mouse.wheel(0, 300);
        return header.evaluate((element) => element.hasAttribute('data-inverse'));
      },
      { timeout: 30_000, intervals: [100] },
    )
    .toBe(true);
  await page.locator('.menu-button--open').click();
  const menu = page.locator('#site-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('background-color', paper.light);
});

/**
 * Every page in every language, light and dark, on a computer and on a phone,
 * against WCAG 2.2 AA and axe's best practices.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { locales, pagesIn, prefix, settled } from './support';

const screens = [
  { name: 'computer', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
];

for (const { name, viewport } of screens) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`${name}, ${colorScheme}`, () => {
      // axe is added to the page as a script, which the site's own policy
      // would rightly block. Without motion, every section is at rest.
      test.use({ viewport, colorScheme, contextOptions: { reducedMotion: 'reduce' }, bypassCSP: true });

      for (const { code } of locales) {
        test(code, async ({ page }) => {
          await settled(page.context());
          const failures: string[] = [];
          for (const path of [...pagesIn(code), `${prefix(code)}/no-such-page`]) {
            await page.goto(path, { waitUntil: 'networkidle' });
            // Sections that rise into view as the reader scrolls, shown as they end up.
            await page.evaluate(() => {
              for (const element of document.querySelectorAll<HTMLElement>('[data-reveal]')) element.dataset.reveal = 'done';
            });
            await page.waitForTimeout(500);
            const { violations } = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
              .analyze();
            for (const violation of violations) {
              const where = violation.nodes.slice(0, 3).map((node) => node.target.join(' '));
              failures.push(`${path}: ${violation.id} (${violation.impact}) at ${where.join(', ')}`);
            }
          }
          expect(failures).toEqual([]);
        });
      }
    });
  }
}

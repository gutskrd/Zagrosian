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
            // Every part of the page as a reader sees it on reaching it: the
            // sections that rise into view where they end up, and the sections
            // the browser only draws as the reader nears them (content-
            // visibility in global.css) drawn. Undrawn, axe would find no
            // background behind their text and take it to be white.
            await page.addStyleTag({ content: '* { content-visibility: visible !important; }' });
            await page.evaluate(async () => {
              for (const element of document.querySelectorAll<HTMLElement>('[data-reveal]')) element.dataset.reveal = 'done';
              await document.fonts.ready;
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });
            const { violations } = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
              .analyze();
            for (const violation of violations) {
              const where = violation.nodes.slice(0, 3).map((node) => {
                // For contrast, the colours axe found, so a failure on CI can be told apart.
                const data = node.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
                const colours = data?.fgColor ? ` (${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1)` : '';
                return `${node.target.join(' ')}${colours}`;
              });
              failures.push(`${path}: ${violation.id} (${violation.impact}) at ${where.join(', ')}`);
            }
          }
          expect(failures).toEqual([]);
        });
      }
    });
  }
}

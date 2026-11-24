/**
 * axe-core audit (WCAG 2.2 AA plus best practices) of every page in every locale, light and dark,
 * on desktop and mobile.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { locales, pagesIn, prefix, settled } from './support';

const screens = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
];

for (const { name, viewport } of screens) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`${name}, ${colorScheme}`, () => {
      // axe is injected as a script, which the site's CSP would (correctly) block. Reduced motion
      // puts every section at rest.
      test.use({ viewport, colorScheme, contextOptions: { reducedMotion: 'reduce' }, bypassCSP: true });

      for (const { code } of locales) {
        test(code, async ({ page }) => {
          await settled(page.context());
          const failures: string[] = [];
          for (const path of [...pagesIn(code), `${prefix(code)}/no-such-page`]) {
            await page.goto(path, { waitUntil: 'networkidle' });
            // Render every section as a reader would see it: revealed sections in their final
            // position, and `content-visibility` sections (global.css) actually rendered.
            // Unrendered, axe finds no background behind their text and assumes white.
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
                // Include the colors axe measured, so contrast failures in CI are diagnosable.
                const data = node.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
                const colors = data?.fgColor ? ` (${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1)` : '';
                return `${node.target.join(' ')}${colors}`;
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

/**
 * Every page in every language, at six screen sizes from a small phone to a
 * large monitor: nothing runs off the screen or is cut off, and everything a
 * visitor taps or clicks is at least 24 by 24 pixels (WCAG 2.2, 2.5.8).
 */
import { expect, test } from '@playwright/test';
import { missing, pages } from './support';

const sizes = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const viewport of sizes) {
  test.describe(`${viewport.width} wide`, () => {
    // Without motion, every section is where it comes to rest.
    test.use({ viewport, contextOptions: { reducedMotion: 'reduce' }, deviceScaleFactor: 1 });

    test('nothing overflows, is cut off or is too small to tap', async ({ page }) => {
      const issues: string[] = [];
      for (const path of [...pages, ...missing]) {
        await page.goto(path, { waitUntil: 'networkidle' });
        const found = await page.evaluate(() => {
          const out: string[] = [];
          const width = document.documentElement.clientWidth;
          const overflow = document.documentElement.scrollWidth - width;
          if (overflow > 0) out.push(`the page is ${overflow}px too wide`);
          // Drawn art that is meant to bleed, hidden text and closed popovers.
          const exempt = '.visually-hidden, [popover], .site-footer__mark, .lifted-logo, .showcase__art';
          for (const element of document.querySelectorAll<HTMLElement>('h1, h2, h3, p, a, button, li, dd, dt, span')) {
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || element.closest(exempt)) continue;
            const box = element.getBoundingClientRect();
            if (box.width === 0) continue;
            const name = `${element.localName}.${element.className.toString().split(' ')[0]} "${element.textContent?.trim().slice(0, 24)}"`;
            if (box.right > width + 0.5 || box.left < -0.5) out.push(`${name} spans ${Math.round(box.left)} to ${Math.round(box.right)}`);
            if (element.scrollWidth > element.clientWidth + 1 && style.overflowX !== 'visible') out.push(`${name} is cut off`);
          }
          // Links within running text are exempt from the target size.
          for (const element of document.querySelectorAll<HTMLElement>('a, button, summary')) {
            const box = element.getBoundingClientRect();
            if (getComputedStyle(element).display === 'none' || box.width === 0) continue;
            if (element.closest('[popover], .skip-link, .legal__content, .contact__note, .showcase__soon-text')) continue;
            if (box.width < 24 || box.height < 24) {
              out.push(`target ${Math.round(box.width)}x${Math.round(box.height)}: "${element.textContent?.trim().slice(0, 20)}"`);
            }
          }
          return [...new Set(out)];
        });
        issues.push(...found.map((issue) => `${path}: ${issue}`));
      }
      expect(issues).toEqual([]);
    });
  });
}

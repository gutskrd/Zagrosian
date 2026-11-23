/**
 * Hevalo's deer (HevaloDeer.astro) emerges from behind the page: while its icon enters the viewport
 * only the copy inside the hole is visible, and once fully out only the front copy is, at full
 * size. With reduced motion it's out from the start.
 */
import { type Page, expect, test } from '@playwright/test';
import { settled } from './support';

test.use({ viewport: { width: 1440, height: 900 } });

/** Scrolls so the deer's top is `from` px above the bottom of the viewport. */
async function scrollDeerTo(page: Page, from: number) {
  await page.evaluate((from) => {
    const deer = document.querySelector('.deer')!;
    const top = deer.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top - innerHeight + from, behavior: 'instant' });
  }, from);
  // Two frames for the scroll-driven animations to update.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

const state = (page: Page) =>
  page.evaluate(() => {
    const opacity = (selector: string) => Number(getComputedStyle(document.querySelector(selector)!).opacity);
    const front = document.querySelector('.deer__body--front')!;
    return {
      behind: opacity('.deer__body--behind'),
      front: opacity('.deer__body--front'),
      veil: opacity('.deer__veil'),
      scale: new DOMMatrix(getComputedStyle(front).transform).a,
    };
  });

test('emerges from the icon as it scrolls into view and retreats on the way back', async ({ page }) => {
  await settled(page.context());
  await page.goto('/', { waitUntil: 'networkidle' });

  // Just entering view: still inside the hole.
  await scrollDeerTo(page, 20);
  expect(await state(page)).toMatchObject({ behind: 1, front: 0 });

  // Mid-viewport: fully out, in front of the page, at full size.
  await scrollDeerTo(page, 900 / 2 + 200);
  const out = await state(page);
  expect(out).toMatchObject({ behind: 0, front: 1, veil: 0 });
  expect(out.scale).toBeCloseTo(1, 2);

  // Scrolled back up: back inside.
  await scrollDeerTo(page, 20);
  expect(await state(page)).toMatchObject({ behind: 1, front: 0 });
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('is shown fully emerged', async ({ page }) => {
    await settled(page.context());
    await page.goto('/', { waitUntil: 'networkidle' });
    await scrollDeerTo(page, 20);
    expect(await state(page)).toMatchObject({ behind: 0, front: 1, veil: 0 });
  });
});

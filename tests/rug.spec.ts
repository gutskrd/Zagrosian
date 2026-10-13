/**
 * The kilim beside the About text: drawn in 3D once it comes near, without
 * errors, and unrolled by the scroll: rolled up as it comes in from below,
 * hanging at full length once it is in view, rolled up again when scrolled
 * back. Its box keeps its size throughout, so nothing around it moves. With
 * reduced motion it hangs still, at full length.
 */
import { type Page, expect, test } from '@playwright/test';
import sharp from 'sharp';
import { settled, watch } from './support';

test.use({ viewport: { width: 1440, height: 900 } });

/** Scrolls so the rug's top is this share of the screen's height from the top. */
async function placeRug(page: Page, share: number) {
  await page.evaluate((share) => {
    const top = document.querySelector('[data-rug]')!.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top - innerHeight * share, behavior: 'instant' });
  }, share);
  // Long enough for the software renderer the tests use to settle.
  await page.waitForTimeout(1500);
}

/** How far the rug has unrolled, from 0 to 1, as it records when it comes to rest. */
const unrolled = (page: Page) =>
  page.locator('[data-rug]').evaluate((element) => Number((element as HTMLElement).dataset.unrolled ?? NaN));

/** The share of the rug's box drawn in dark wool, as on the screen. */
async function darkShare(page: Page) {
  const box = (await page.locator('[data-rug]').boundingBox())!;
  const view = page.viewportSize()!;
  const top = Math.max(0, box.y);
  const clip = { x: box.x, y: top, width: box.width, height: Math.min(box.y + box.height, view.height) - top };
  const { data, info } = await sharp(await page.screenshot({ clip })).raw().toBuffer({ resolveWithObject: true });
  let dark = 0;
  for (let i = 0; i < data.length; i += info.channels) if (data[i] + data[i + 1] + data[i + 2] < 150) dark++;
  return dark / (box.width * box.height);
}

test('the rug is drawn in 3D and unrolls with the scroll', async ({ page }) => {
  await settled(page.context());
  const problems = await watch(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  const rug = page.locator('[data-rug]');
  const size = await rug.evaluate((element) => [element.clientWidth, element.clientHeight]);

  await placeRug(page, 0.85);
  await expect(rug).toHaveAttribute('data-live', '');
  await expect.poll(() => unrolled(page), { message: 'coming in, it is still rolled up' }).toBeLessThan(0.15);
  await placeRug(page, 0.05);
  await expect.poll(() => unrolled(page), { message: 'in view, it hangs at full length' }).toBe(1);
  expect(await darkShare(page), 'and it is drawn').toBeGreaterThan(0.07);
  await placeRug(page, 0.85);
  await expect.poll(() => unrolled(page), { message: 'scrolled back, it rolls up again' }).toBeLessThan(0.15);

  expect(await rug.evaluate((element) => [element.clientWidth, element.clientHeight])).toEqual(size);
  expect(problems).toEqual([]);
});

test('with reduced motion, it hangs still and unrolled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settled(page.context());
  await page.goto('/', { waitUntil: 'networkidle' });
  await placeRug(page, 0.85);
  await expect(page.locator('[data-rug]')).toHaveAttribute('data-live', '');
  expect(await unrolled(page)).toBe(1);
  await placeRug(page, 0.05);
  expect(await darkShare(page)).toBeGreaterThan(0.07);
});

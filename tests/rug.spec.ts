/**
 * The kilim beside the About text: drawn in 3D once it comes near, without
 * errors; it falls onto the page and comes to rest; a corner can be picked up
 * with the mouse and folded over, and it stays folded when let go; scrolled
 * away and back, it lies straight again. On a touch screen a swipe over it
 * still scrolls the page, and pressing and holding picks it up instead. With
 * reduced motion it lies still and cannot be picked up. Its box never
 * changes size, so nothing around it moves.
 */
import { type Page, expect, test } from '@playwright/test';
import sharp from 'sharp';
import { settled, watch } from './support';

const rug = (page: Page) => page.locator('[data-rug]');

/** Waits until the rug has come to rest (the software renderer the tests use is slow). */
const resting = (page: Page) =>
  expect.poll(() => rug(page).getAttribute('data-state'), { timeout: 30_000, intervals: [250] }).toBe('resting');

/** The rug's box on the screen, as pixels. */
async function picture(page: Page) {
  const box = (await rug(page).boundingBox())!;
  const view = page.viewportSize()!;
  const top = Math.max(0, box.y);
  const clip = { x: box.x, y: top, width: box.width, height: Math.min(box.y + box.height, view.height) - top };
  const { data, info } = await sharp(await page.screenshot({ clip })).raw().toBuffer({ resolveWithObject: true });
  return { data, info, clip };
}

/** How different two pictures are, from 0 (the same) to 1. */
function difference(a: Awaited<ReturnType<typeof picture>>, b: Awaited<ReturnType<typeof picture>>) {
  let sum = 0;
  const length = Math.min(a.data.length, b.data.length);
  for (let i = 0; i < length; i++) sum += Math.abs(a.data[i] - b.data[i]);
  return sum / length / 255;
}

/** A point on the screen just inside the rug's lower left corner, found in the picture. */
async function corner(page: Page) {
  const { data, info, clip } = await picture(page);
  const floor = [data[0], data[1], data[2]];
  let best = [0, 0];
  let score = -Infinity;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (Math.abs(data[i] - floor[0]) + Math.abs(data[i + 1] - floor[1]) + Math.abs(data[i + 2] - floor[2]) < 60) continue;
      if (y - x > score) {
        score = y - x;
        best = [x, y];
      }
    }
  }
  const middle = [info.width / 2, info.height / 2];
  const towards = 14 / Math.hypot(middle[0] - best[0], middle[1] - best[1]);
  return {
    x: clip.x + best[0] + (middle[0] - best[0]) * towards,
    y: clip.y + best[1] + (middle[1] - best[1]) * towards,
    middle: { x: clip.x + middle[0], y: clip.y + middle[1] },
  };
}

/** Brings the rug into view and waits for it to fall and come to rest. */
async function arrive(page: Page) {
  await rug(page).scrollIntoViewIfNeeded();
  await expect(rug(page)).toHaveAttribute('data-live', '');
  await resting(page);
}

test.describe('with a mouse', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('it falls onto the page, a corner can be folded over, and it is laid straight again', async ({ page }) => {
    await settled(page.context());
    const problems = await watch(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    const size = await rug(page).evaluate((element) => [element.clientWidth, element.clientHeight]);
    await arrive(page);
    const before = await picture(page);

    const from = await corner(page);
    await page.mouse.move(from.x, from.y);
    await expect(rug(page), 'over the rug, the pointer is a hand').toHaveAttribute('data-over', '');
    await page.mouse.down();
    await expect(rug(page)).toHaveAttribute('data-holding', '');
    await page.mouse.move(from.x + (from.middle.x - from.x) * 1.1, from.y + (from.middle.y - from.y) * 1.1, { steps: 30 });
    await page.mouse.up();
    await expect(rug(page)).not.toHaveAttribute('data-holding', '');
    await resting(page);
    const folded = difference(before, await picture(page));
    expect(folded, 'let go, it stays folded').toBeGreaterThan(0.03);

    // Away and back: straight again.
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => rug(page).getAttribute('data-state')).toBe('resting');
    await rug(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    // (It first came to rest from its fall, a hair differently.)
    expect(difference(before, await picture(page)), 'back again, it lies straight').toBeLessThan(folded / 2);

    expect(await rug(page).evaluate((element) => [element.clientWidth, element.clientHeight])).toEqual(size);
    expect(problems).toEqual([]);
  });

  test('with reduced motion, it lies still and cannot be picked up', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settled(page.context());
    await page.goto('/', { waitUntil: 'networkidle' });
    await arrive(page);
    const before = await picture(page);
    const from = await corner(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.middle.x, from.middle.y, { steps: 10 });
    await page.mouse.up();
    await expect(rug(page)).not.toHaveAttribute('data-holding', '');
    expect(difference(before, await picture(page))).toBeLessThan(0.005);
  });
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  /** A finger: down at `from`, held for `hold` ms, then drawn to `to`, and up. */
  async function finger(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, hold: number, check?: () => Promise<void>) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', from.x, from.y);
    await page.waitForTimeout(hold);
    for (let step = 1; step <= 12; step++) {
      await touch('touchMove', from.x + ((to.x - from.x) * step) / 12, from.y + ((to.y - from.y) * step) / 12);
      await page.waitForTimeout(16);
    }
    await check?.();
    await touch('touchEnd', to.x, to.y);
  }

  test('a swipe over it scrolls the page; pressing and holding picks it up', async ({ page }) => {
    await settled(page.context());
    await page.goto('/', { waitUntil: 'networkidle' });
    await arrive(page);
    const from = await corner(page);

    const before = await page.evaluate(() => scrollY);
    await finger(page, from, { x: from.x, y: from.y - 200 }, 0);
    await expect.poll(() => page.evaluate(() => scrollY), { message: 'the swipe scrolls' }).toBeGreaterThan(before + 50);
    await expect(rug(page)).not.toHaveAttribute('data-holding', '');

    await rug(page).scrollIntoViewIfNeeded();
    await resting(page);
    const held = await corner(page);
    const still = await page.evaluate(() => scrollY);
    await finger(page, held, held.middle, 450, async () => {
      await expect(rug(page), 'held, it is picked up').toHaveAttribute('data-holding', '');
    });
    expect(await page.evaluate(() => scrollY), 'and the page stays put').toBe(still);
  });
});

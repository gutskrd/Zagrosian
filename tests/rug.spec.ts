/**
 * Homepage rug: renders in 3D without errors, already at rest (never settling in view); a corner
 * can be grabbed with the mouse and folded over, and stays folded on release; scrolling away and
 * back resets it. On touch, vertical swipes still scroll; a long press or a horizontal start grabs
 * it; a tap lifts the corner and lays it back; pinch still zooms. With reduced motion it's static
 * and can't be grabbed, but a tap or the button still folds the corner instantly. Its box never
 * changes size, so nothing around it shifts.
 */
import { type Page, expect, test } from '@playwright/test';
import sharp from 'sharp';
import { settled, watch } from './support';

const rug = (page: Page) => page.locator('[data-rug]');

/** Waits until the rug is at rest (the software renderer used in tests is slow). */
const resting = (page: Page) =>
  expect.poll(() => rug(page).getAttribute('data-state'), { timeout: 30_000, intervals: [250] }).toBe('resting');

/** Screenshot of the rug's on-screen box, as raw pixels. */
async function picture(page: Page) {
  const box = (await rug(page).boundingBox())!;
  const view = page.viewportSize()!;
  const top = Math.max(0, box.y);
  const clip = { x: box.x, y: top, width: box.width, height: Math.min(box.y + box.height, view.height) - top };
  const { data, info } = await sharp(await page.screenshot({ clip })).raw().toBuffer({ resolveWithObject: true });
  return { data, info, clip };
}

/** Pixel difference between two screenshots, 0 (identical) to 1. */
function difference(a: Awaited<ReturnType<typeof picture>>, b: Awaited<ReturnType<typeof picture>>) {
  let sum = 0;
  const length = Math.min(a.data.length, b.data.length);
  for (let i = 0; i < length; i++) sum += Math.abs(a.data[i] - b.data[i]);
  return sum / length / 255;
}

/**
 * A point just inside the rug's lower-left corner, found in the screenshot: the rug is saturated
 * dyed wool while the floor isn't, so the rug is where the color is.
 */
async function corner(page: Page) {
  const { data, info, clip } = await picture(page);
  let best = [0, 0];
  let score = -Infinity;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) < 45) continue;
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

/** Scrolls the rug into view and waits for the 3D scene to be ready and at rest. */
async function arrive(page: Page) {
  await rug(page).scrollIntoViewIfNeeded();
  await expect(rug(page)).toHaveAttribute('data-live', '');
  await resting(page);
}

test.describe('with a mouse', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('it lies there, a corner can be folded over, and it is laid straight again', async ({ page }) => {
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

    // Away (to the bottom of the page) and back: reset.
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await expect.poll(() => rug(page).getAttribute('data-state')).toBe('resting');
    await rug(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
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

  /** Tap: touch down and up immediately. */
  async function tap(page: Page, at: { x: number; y: number }) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y, id: 1 }] });
    await page.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /**
   * Touch gesture: down at `from`, held for `hold` ms (and until `held` resolves, if given, since
   * the page's hold timer can fire late on a busy machine), then dragged to `to`, and up.
   */
  async function finger(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
    hold: number,
    check?: () => Promise<void>,
    held?: () => Promise<void>,
  ) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', from.x, from.y);
    await page.waitForTimeout(hold);
    await held?.();
    for (let step = 1; step <= 12; step++) {
      await touch('touchMove', from.x + ((to.x - from.x) * step) / 12, from.y + ((to.y - from.y) * step) / 12);
      await page.waitForTimeout(16);
    }
    await check?.();
    await touch('touchEnd', to.x, to.y);
  }

  /**
   * Scroll position once scrolling has stopped; a swipe's fling may still be coasting when the test
   * moves on.
   */
  async function scrolled(page: Page) {
    let last = NaN;
    await expect
      .poll(
        async () => {
          const now = await page.evaluate(() => scrollY);
          const same = now === last;
          last = now;
          return same;
        },
        { message: 'the page comes to a stop', intervals: [250], timeout: 10_000 },
      )
      .toBe(true);
    return last;
  }

  /**
   * Asserts the page hasn't scrolled since `still`. Scrolling with the finger would move it by the
   * stroke height (10-150px here); 1px is the browser rounding a fractional scroll position (layout
   * uses subpixels), which CI's browser occasionally does.
   */
  async function stayedPut(page: Page, still: number) {
    expect(Math.abs((await page.evaluate(() => scrollY)) - still), 'and the page stays put').toBeLessThanOrEqual(1);
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
    const still = await scrolled(page);
    await finger(
      page,
      held,
      held.middle,
      450,
      async () => {
        await expect(rug(page), 'drawn on, it is still held').toHaveAttribute('data-holding', '');
      },
      async () => {
        await expect(rug(page), 'held, it is picked up').toHaveAttribute('data-holding', '');
      },
    );
    await stayedPut(page, still);
  });

  test('set off sideways, it is picked up at once; a tap lifts the corner and lays it back', async ({ page }) => {
    await settled(page.context());
    const problems = await watch(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await arrive(page);
    const { middle } = await corner(page);
    const still = await scrolled(page);
    await finger(page, middle, { x: middle.x - 120, y: middle.y + 10 }, 0, async () => {
      await expect(rug(page), 'drawn sideways without waiting, it is picked up').toHaveAttribute('data-holding', '');
    });
    await stayedPut(page, still);
    await resting(page);

    const button = page.locator('[data-rug-button]');
    await tap(page, (await corner(page)).middle);
    await expect(rug(page), 'a tap lifts the corner').toHaveAttribute('data-lifted', '');
    await expect(button).toHaveText('Lay it back');
    await resting(page);
    await tap(page, (await corner(page)).middle);
    // Laid back once the corner returns: a one-second animation that the slow software renderer
    // draws in far fewer frames.
    await expect(rug(page), 'and another lays it back').not.toHaveAttribute('data-lifted', '', { timeout: 30_000 });
    await expect(button).toHaveText('Lift the rug');
    expect(problems).toEqual([]);
  });

  // Whether the page actually zooms is up to the browser, and not every test browser emulates
  // pinch. So this checks that the rug allows it, and that two fingers drawn apart horizontally
  // (dispatched to the rug directly, as a browser that doesn't handle the pinch itself would) don't
  // grab it.
  test('two fingers on it are left to zoom the page', async ({ page }) => {
    await settled(page.context());
    await page.goto('/', { waitUntil: 'networkidle' });
    await arrive(page);
    expect(await rug(page).evaluate((element) => getComputedStyle(element).touchAction)).toBe('pan-y pinch-zoom');
    const held = await page.locator('.rug__canvas').evaluate(async (canvas) => {
      const box = canvas.getBoundingClientRect();
      const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
      const send = (type: string, id: number, at: number) =>
        canvas.dispatchEvent(
          new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: at, clientY: y, bubbles: true }),
        );
      send('pointerdown', 1, x - 20);
      send('pointerdown', 2, x + 20);
      for (let apart = 24; apart <= 100; apart += 4) {
        send('pointermove', 1, x - apart);
        send('pointermove', 2, x + apart);
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      // Longer than the press-to-hold delay.
      await new Promise((resolve) => setTimeout(resolve, 400));
      const holding = canvas.parentElement!.hasAttribute('data-holding');
      send('pointerup', 1, x - 100);
      send('pointerup', 2, x + 100);
      return holding;
    });
    expect(held, 'a pinch does not pick it up').toBe(false);
  });

  test('with reduced motion, a tap still lifts it, at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settled(page.context());
    const problems = await watch(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await rug(page).scrollIntoViewIfNeeded();
    await expect(rug(page)).toHaveAttribute('data-live', '');
    await page.waitForTimeout(500);
    const before = await picture(page);
    const { middle } = await corner(page);
    await tap(page, middle);
    await expect(rug(page)).toHaveAttribute('data-lifted', '');
    await expect.poll(async () => difference(before, await picture(page)), { message: 'the corner is folded over' }).toBeGreaterThan(0.01);
    await tap(page, middle);
    await expect(rug(page)).not.toHaveAttribute('data-lifted', '');
    await expect.poll(async () => difference(before, await picture(page)), { message: 'and laid back' }).toBeLessThan(0.002);
    expect(problems).toEqual([]);
  });
});

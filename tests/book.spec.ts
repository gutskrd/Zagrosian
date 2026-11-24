/**
 * Book page (/book) and reader: the cover alone and centered, spreads on desktop and single pages
 * on mobile. Covers turning via buttons, keys (also before the book has focus, and `[`/`]` with
 * AltGr), clicks, rapid clicks that each count, drag, swipe and edge taps, chapter jumps from the
 * contents; instant changes with reduced motion; correct direction on RTL pages with locale digits.
 * Also zoom, the scroll view (every page in a column, toolbar tracking the page being read), the
 * text view, and full view (over the header, trapping focus); focus stays in the book on the last
 * page; only nearby pages are fetched, all same-origin; toolbar controls never overlap and the
 * chapter name fits in every locale at every width; the download is the PDF under its own filename,
 * including from the phone toolbar. Without JS the pages render as a column; a missing image or a
 * reader that fails to start both leave the book readable.
 */
import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import { settled } from './support';

const manifest = JSON.parse(readFileSync(new URL('../src/assets/book/book.json', import.meta.url), 'utf8')) as {
  pageCount: number;
  pdf: { bytes: number };
  chapters: { number: number; start: number; end: number }[];
};
const chapter = (number: number) => manifest.chapters.find((item) => item.number === number)!;

// The last two spreads on desktop: with an even page count the last page sits beside the end card;
// with an odd one the last two pages share a spread and the end card follows alone.
const even = manifest.pageCount % 2 === 0;
const lastSpread = even ? [String(manifest.pageCount), 'end'] : ['end'];
const spreadBeforeLast = even
  ? [String(manifest.pageCount - 2), String(manifest.pageCount - 1)]
  : [String(manifest.pageCount - 1), String(manifest.pageCount)];

const reader = (page: Page) => page.locator('[data-book]');
const stage = (page: Page) => page.locator('[data-book-stage]');

/** Open pages by number ('end' for the end card). */
const shown = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-book] [data-shown]')].map((element) => element.dataset.n ?? 'end'));

/** Opens a book page with the reader initialized and no turn in progress. */
async function open(page: Page, path = '/book') {
  await settled(page.context());
  await page.goto(path, { waitUntil: 'networkidle' });
  await expect(reader(page)).not.toHaveAttribute('data-book', 'off');
  await expect(page.locator('[data-book-range]')).toHaveAttribute('aria-valuetext', /./);
}

/** Waits until no leaves are moving. */
const still = (page: Page) => expect(reader(page)).not.toHaveAttribute('data-turning', '');

async function expectShown(page: Page, pages: string[]) {
  await expect.poll(() => shown(page)).toEqual(pages);
  await still(page);
}

test.describe('serving', () => {
  test('serves /book and redirects /book/ to it', async ({ request }) => {
    const response = await request.get('/book');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('data-book');
    const slash = await request.get('/book/', { maxRedirects: 0 });
    expect(slash.status()).toBeGreaterThanOrEqual(301);
    expect(slash.status()).toBeLessThanOrEqual(308);
    expect(new URL(slash.headers()['location']!, 'http://127.0.0.1:8788').pathname).toBe('/book');
  });
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('opens on the cover, centered', async ({ page }) => {
    await open(page);
    expect(await shown(page)).toEqual(['1']);
    const cover = (await page.locator('#page-1').boundingBox())!;
    const box = (await stage(page).boundingBox())!;
    expect(Math.abs(cover.x + cover.width / 2 - (box.x + box.width / 2))).toBeLessThan(2);
  });

  test('turns forward with the button, the arrow key and a click on the right page', async ({ page }) => {
    await open(page);
    await page.locator('[data-book-next]').click();
    await expectShown(page, ['2', '3']);
    expect(new URL(page.url()).hash).toBe('#page-2');
    await stage(page).focus();
    await page.keyboard.press('ArrowRight');
    await expectShown(page, ['4', '5']);
    const right = (await page.locator('#page-5').boundingBox())!;
    await page.mouse.click(right.x + right.width / 2, right.y + right.height / 2);
    await expectShown(page, ['6', '7']);
    expect(new URL(page.url()).hash).toBe('#page-6');
  });

  test('turns back, and jumps to the cover and the end', async ({ page }) => {
    await open(page, '/book#page-10');
    await expectShown(page, ['10', '11']);
    await stage(page).focus();
    await page.keyboard.press('ArrowLeft');
    await expectShown(page, ['8', '9']);
    await page.keyboard.press('Home');
    await expectShown(page, ['1']);
    expect(new URL(page.url()).hash).toBe('');
    await page.keyboard.press('End');
    await expectShown(page, lastSpread);
  });

  test('jumps by chapter with ] and the contents, and marks the current chapter', async ({ page }) => {
    await open(page);
    await stage(page).focus();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press(']');
      await still(page);
    }
    const opener = String(chapter(3).start);
    await expect.poll(() => shown(page)).toContain(opener);
    await expect(page.locator('#book-contents [data-book-chapter="3"]')).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('Home');
    await expectShown(page, ['1']);
    await page.locator('[popovertarget="book-contents"]').first().click();
    await page.locator('#book-contents [data-book-chapter="3"]').click();
    await expect.poll(() => shown(page)).toContain(opener);
    await expect(page.locator('#book-contents')).not.toBeVisible();
    await expect(stage(page)).toBeFocused();
  });

  test('announces the current page', async ({ page }) => {
    await open(page);
    await page.locator('[data-book-next]').click();
    await expect(page.locator('[data-book-status]')).toHaveText(new RegExp(`Pages 2 and 3 of ${manifest.pageCount}\\.`));
  });

  test('turns once per click when clicked rapidly', async ({ page }) => {
    await open(page, '/book#page-20');
    await expectShown(page, ['20', '21']);
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-book-next]').click();
      await page.waitForTimeout(90);
    }
    await expectShown(page, ['30', '31']);
  });

  test('turns with arrow keys before the book has focus, and shows the shortcuts once it does', async ({ page }) => {
    await open(page, '/book#page-30');
    await expectShown(page, ['30', '31']);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press('ArrowRight');
    await expectShown(page, ['32', '33']);
    await expect(stage(page)).toBeFocused();
    await expect(page.locator('.book__keys')).toBeVisible();
  });

  test('jumps by chapter with [ and ], including AltGr (Ctrl+Alt)', async ({ page }) => {
    await open(page, `/book#page-${chapter(2).start}`);
    await stage(page).focus();
    await page.keyboard.down('Control');
    await page.keyboard.down('Alt');
    await page.keyboard.press(']');
    await page.keyboard.up('Alt');
    await page.keyboard.up('Control');
    await expect.poll(() => shown(page)).toContain(String(chapter(3).start));
  });

  test('keeps focus in the book on the last page and still turns back', async ({ page }) => {
    await open(page, `/book#page-${spreadBeforeLast[0]}`);
    const next = page.locator('[data-book-next]');
    await next.focus();
    await page.keyboard.press('Enter');
    await expectShown(page, lastSpread);
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(next).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expectShown(page, spreadBeforeLast);
  });

  test('opens the page or chapter in the URL fragment', async ({ page }) => {
    await open(page, '/de/book#page-37');
    expect(await shown(page)).toEqual(['36', '37']);
    await open(page, '/book#chapter-4');
    expect(await shown(page)).toContain(String(chapter(4).start));
  });

  test('completes a drag past a third of the page and cancels a shorter one', async ({ page }) => {
    await open(page, '/book#page-2');
    const right = (await page.locator('#page-3').boundingBox())!;
    const y = right.y + right.height * 0.4;
    // Short pull: the page falls back.
    await page.mouse.move(right.x + right.width - 40, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(right.x + right.width - 40 - i * 8, y);
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(900);
    await expectShown(page, ['2', '3']);
    // Past a third: it turns.
    await page.mouse.move(right.x + right.width - 40, y);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) await page.mouse.move(right.x + right.width - 40 - i * 30, y);
    await page.waitForTimeout(100);
    await page.mouse.up();
    await expectShown(page, ['4', '5']);
  });

  test('zooms in with sharper images and back to fit', async ({ page }) => {
    await open(page, '/book#page-2');
    const before = (await page.locator('#page-3').boundingBox())!.width;
    await page.locator('[data-book-zoom="in"]').click();
    await page.locator('[data-book-zoom="in"]').click();
    await expect.poll(async () => (await page.locator('#page-3').boundingBox())!.width / before).toBeCloseTo(2, 1);
    await expect.poll(() => page.locator('#page-3 img').evaluate((img: HTMLImageElement) => img.currentSrc)).toContain('-1440');
    await page.locator('[data-book-zoom="fit"]').click();
    await expect.poll(async () => (await page.locator('#page-3').boundingBox())!.width).toBeCloseTo(before, 0);
  });

  test('text view shows the whole book as text and returns to the current page', async ({ page }) => {
    await open(page, '/book#page-10');
    const toggle = page.locator('[data-book-text-toggle]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const line = page.locator('.book__text [lang="ku"]', { hasText: /^Tu çawa yî\?$/ }).first();
    await line.scrollIntoViewIfNeeded();
    await expect(line).toBeVisible();
    expect(await line.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    // Zoom is unavailable in this view.
    await expect(page.locator('[data-book-zoom="in"]')).toHaveAttribute('aria-disabled', 'true');
    // Reading on to page 14: the toolbar and URL follow.
    await page.locator('#page-14-title').evaluate((heading) => heading.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(page.locator('[data-book-counter-long]')).toHaveText(`Page 14 of ${manifest.pageCount}`);
    await expect.poll(() => new URL(page.url()).hash).toBe('#page-14');
    // The slider scrolls the text to its page.
    const range = page.locator('[data-book-range]');
    await range.evaluate((input: HTMLInputElement) => {
      input.value = String(Number(input.max) - 10);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(20000);
    await page.locator('#page-14-title').evaluate((heading) => heading.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(page.locator('[data-book-counter-long]')).toHaveText(`Page 14 of ${manifest.pageCount}`);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => shown(page)).toContain('14');
  });

  test('scroll view lists every page, tracks the current one and returns to it', async ({ page }) => {
    await open(page, '/book#page-10');
    const toggle = page.locator('[data-book-scroll-toggle]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(reader(page)).toHaveAttribute('data-scroll', '');
    // The previously open page is at the top, below the toolbars, with every page stacked below.
    await expect.poll(() => new URL(page.url()).hash).toBe('#page-10');
    await expect(page.locator('#page-10 img')).toBeInViewport();
    const boxes = await page
      .locator('.book__page')
      .evaluateAll((items) => items.map((item) => item.getBoundingClientRect()).map(({ top, height, width }) => ({ top, height, width })));
    expect(boxes).toHaveLength(manifest.pageCount);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.top).toBeGreaterThan(boxes[i - 1]!.top + boxes[i - 1]!.height - 1);
    // Each page has the right aspect ratio before its image loads and is no wider than the
    // viewport.
    for (const box of boxes) expect(box.height / box.width).toBeCloseTo(595.28 / 419.53, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('[data-book-zoom="in"]')).toHaveAttribute('aria-disabled', 'true');
    // Scrolling on to page 14: the toolbar and URL follow.
    await page.locator('#page-14').evaluate((item) => item.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(page.locator('[data-book-counter-long]')).toHaveText(`Page 14 of ${manifest.pageCount}`);
    await expect.poll(() => new URL(page.url()).hash).toBe('#page-14');
    await expect(page.locator('#page-14 img')).toHaveJSProperty('complete', true);
    // Arrows and `]` step by page and chapter, scrolling the column there.
    await page.locator('[data-book-next]').click();
    await expect(page.locator('[data-book-counter-long]')).toHaveText(`Page 15 of ${manifest.pageCount}`);
    await expect(page.locator('#page-15 img')).toBeInViewport();
    await page.keyboard.press(']');
    const next = manifest.chapters.find((item) => item.start > 15)!.start;
    await expect(page.locator('[data-book-counter-long]')).toHaveText(`Page ${next} of ${manifest.pageCount}`);
    // Scroll view -> text view -> spreads, keeping the same page.
    await page.locator('[data-book-text-toggle]').click();
    await expect(reader(page)).toHaveAttribute('data-text', '');
    await expect(reader(page)).not.toHaveAttribute('data-scroll', '');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(`#page-${next}-title`)).toBeInViewport();
    await page.locator('[data-book-text-toggle]').click();
    await expect.poll(() => shown(page)).toContain(String(next));
  });

  test('scroll view on mobile shows full-width pages with the toolbars in reach', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await open(page, '/book#page-20');
    await page.locator('[data-book-scroll-toggle]').click();
    const box = (await page.locator('#page-20').boundingBox())!;
    expect(box.width).toBeGreaterThan(340);
    expect(box.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Toolbars stay visible while the column scrolls.
    await page.evaluate(() => scrollBy(0, 3000));
    await expect(page.locator('[data-book-scroll-toggle]')).toBeInViewport();
    await expect(page.locator('[data-book-next]')).toBeInViewport();
    await context.close();
  });

  test('full view covers the header, traps focus, exits on Escape and locks page scroll', async ({ page }) => {
    await open(page);
    const toggle = page.locator('[data-book-full-toggle]');
    await toggle.click();
    await expect(reader(page)).toHaveAttribute('data-full', '');
    // What renders where the header was is the book (the header is made hit-testable just for this
    // check).
    const drawn = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('[data-site-header]')!;
      const inert = header.closest('[inert]');
      inert?.removeAttribute('inert');
      const box = header.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      inert?.setAttribute('inert', '');
      return !!hit?.closest('[data-book]');
    });
    expect(drawn).toBe(true);
    const before = await page.evaluate(() => scrollY);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-book]'))).toBe(true);
    }
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    await stage(page).focus();
    await page.keyboard.press('Escape');
    await expect(reader(page)).not.toHaveAttribute('data-full', '');
    await expect(toggle).toBeFocused();
  });

  test('loads only nearby page images, prefetches the next and stays same-origin', async ({ page }) => {
    const pictures: { url: string; bytes: number }[] = [];
    const elsewhere: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith('http://127.0.0.1:8788/')) elsewhere.push(request.url());
    });
    page.on('response', async (response) => {
      if (/\/p\d{3}-(720|1440)\.[\w-]+\.webp$/.test(response.url()))
        pictures.push({ url: response.url(), bytes: (await response.body()).length });
    });
    await open(page);
    await page.waitForTimeout(800);
    const numbers = pictures.map((picture) => Number(/\/p(\d{3})-/.exec(picture.url)![1]));
    expect(pictures.length).toBeLessThanOrEqual(6);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(5);
    expect(numbers).toContain(2);
    expect(numbers).toContain(3);
    expect(pictures.reduce((sum, picture) => sum + picture.bytes, 0)).toBeLessThan(1_000_000);
    expect(elsewhere).toEqual([]);

    // In-page links must not trigger document fetches.
    const documents: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documents.push(request.url());
    });
    await page.locator('.book-inside [data-book-chapter="2"]').hover();
    await page.waitForTimeout(600);
    expect(documents).toEqual([]);
  });

  test('downloads the PDF under its own file name', async ({ page, request }) => {
    await open(page);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.book-intro [data-book-download]').click()]);
    expect(download.suggestedFilename()).toBe('Reya-Kurmanci-Pirtuka-Hevalo.pdf');
    const response = await request.get('/book/reya-kurmanci.pdf');
    const headers = response.headers();
    // Generic binary type, so browsers with a built-in PDF viewer save the file instead of opening
    // it.
    expect(headers['content-type']).toBe('application/octet-stream');
    expect(headers['content-disposition']).toContain('attachment');
    expect(headers['x-robots-tag']).toBe('noindex');
    expect((await response.body()).length).toBe(manifest.pdf.bytes);
    await expect(page.locator('.book-intro .book-download__facts')).toContainText(`${(manifest.pdf.bytes / 1e6).toFixed(1)} MB`);
  });
});

test.describe('toolbars', () => {
  test('keep controls apart and labels whole in every language, from 320 px to wide screens', async ({ page }) => {
    test.setTimeout(120_000);
    const problems: string[] = [];
    for (const code of ['', 'ku', 'ckb', 'ar', 'fa', 'tr', 'de', 'fr', 'es', 'nl']) {
      await open(page, code ? `/${code}/book` : '/book');
      for (const width of [320, 360, 375, 420, 600, 700, 768, 900, 1000, 1199, 1280, 1360, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const found = await page.evaluate(() => {
          const bars = [...document.querySelectorAll<HTMLElement>('[data-book] .book__bar')];
          const boxes = bars.map((bar) =>
            [...bar.children]
              .filter((child) => child.checkVisibility() && getComputedStyle(child).position !== 'absolute')
              .map((child) => child.getBoundingClientRect())
              .filter((box) => box.width > 0),
          );
          // The contents button intentionally overhangs its bar's edge slightly, so a few pixels of
          // contact are allowed.
          const apart = boxes.every((one, i) =>
            boxes
              .slice(i + 1)
              .every((other) =>
                one.every((a) =>
                  other.every((b) => a.right - 10 <= b.left || b.right - 10 <= a.left || a.bottom - 1 <= b.top || b.bottom - 1 <= a.top),
                ),
              ),
          );
          const name = document.querySelector<HTMLElement>('[data-book] .book__where-text')!;
          return { apart, cut: name.scrollWidth > name.clientWidth + 1, wide: document.documentElement.scrollWidth > innerWidth };
        });
        if (!found.apart || found.cut || found.wide) problems.push(`${code || 'en'} at ${width}: ${JSON.stringify(found)}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('shows the download in the toolbar above the book', async ({ page }) => {
    await open(page);
    const download = page.locator('.book__bar--end [data-book-download]:visible');
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute('download', 'Reya-Kurmanci-Pirtuka-Hevalo.pdf');
  });

  test('pans a zoomed page horizontally by touch', async ({ page }) => {
    await open(page);
    await reader(page).evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    const box = (await page.locator('#page-1').boundingBox())!;
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await tap(page, at);
    await page.waitForTimeout(120);
    await tap(page, at);
    await expect(reader(page)).toHaveAttribute('data-zoom', '');
    // pan-x pan-y pinch-zoom, which the browser serializes as "manipulation".
    expect(await stage(page).evaluate((element) => getComputedStyle(element).touchAction)).toMatch(/manipulation|pan-x/);
    const before = await stage(page).evaluate((element) => element.scrollLeft);
    await swipe(page, { x: at.x - 80, y: at.y }, { x: at.x + 80, y: at.y });
    await expect.poll(() => stage(page).evaluate((element) => element.scrollLeft)).toBeLessThan(before - 40);
  });

  /** Drags a finger from one point to another in a dozen steps. */
  async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', from.x, from.y);
    for (let step = 1; step <= 12; step++) {
      await touch('touchMove', from.x + ((to.x - from.x) * step) / 12, from.y + ((to.y - from.y) * step) / 12);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', to.x, to.y);
  }

  async function tap(page: Page, at: { x: number; y: number }) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y, id: 1 }] });
    await page.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  test('shows a single 358 px page without horizontal scrolling', async ({ page }) => {
    await open(page);
    const cover = (await page.locator('#page-1').boundingBox())!;
    expect(Math.abs(cover.width - 358)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('turns on a horizontal swipe or an edge tap, and scrolls on a vertical swipe', async ({ page }) => {
    await open(page);
    await reader(page).evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    const box = (await page.locator('#page-1').boundingBox())!;
    const y = box.y + box.height / 2;
    await swipe(page, { x: box.x + box.width * 0.8, y }, { x: box.x + box.width * 0.1, y });
    await expectShown(page, ['2']);

    const before = await page.evaluate(() => scrollY);
    await swipe(page, { x: box.x + box.width / 2, y: y + 120 }, { x: box.x + box.width / 2 + 6, y: y - 120 });
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before + 40);
    expect(await shown(page)).toEqual(['2']);

    const now = (await page.locator('#page-2').boundingBox())!;
    await tap(page, { x: now.x + now.width - 20, y: now.y + now.height / 2 });
    await expectShown(page, ['3']);
  });
});

test.describe('narrow mobile, in Kurmanji', () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

  test('fits the gesture hint without covering anything but the bottom toolbar', async ({ page }) => {
    await open(page, '/ku/book');
    await reader(page).evaluate((element) => element.scrollIntoView({ block: 'start' }));
    const hint = page.locator('[data-book-hint]');
    await expect(hint).toBeVisible();
    const { box, bar, whole } = await hint.evaluate((element) => ({
      box: element.getBoundingClientRect().toJSON() as DOMRect,
      bar: element.closest('.book__bar')!.getBoundingClientRect().toJSON() as DOMRect,
      // Every line fits: nothing overflows its box in either direction.
      whole:
        element.scrollHeight <= element.clientHeight + 1 && [...element.children].every((line) => line.scrollWidth <= line.clientWidth + 1),
    }));
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(320);
    expect(box.top).toBeGreaterThanOrEqual(bar.top - 1);
    expect(box.bottom).toBeLessThanOrEqual(bar.bottom + 1);
    expect(whole).toBe(true);
    // Hides after a few seconds.
    await expect(hint).toBeHidden({ timeout: 8000 });
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: 'reduce' } });

  test('changes pages instantly, without a turning leaf', async ({ page }) => {
    await open(page);
    await page.locator('[data-book-next]').click();
    expect(await shown(page)).toEqual(['2', '3']);
    // No leaf, and nothing in the book animating.
    await expect(reader(page)).not.toHaveAttribute('data-turning', '');
    expect(await page.locator('.leaf[data-active]').count()).toBe(0);
    expect(
      await page.evaluate(
        () =>
          document.getAnimations().filter((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            return target instanceof Element && target.closest('[data-book-spread]');
          }).length,
      ),
    ).toBe(0);
  });
});

test.describe('right-to-left', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const code of ['ar', 'fa', 'ckb']) {
    test(code, async ({ page }) => {
      await open(page, `/${code}/book`);
      expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
      expect(await stage(page).getAttribute('dir')).toBe('ltr');
      const previous = (await page.locator('[data-book-prev]').boundingBox())!;
      const next = (await page.locator('[data-book-next]').boundingBox())!;
      expect(next.x).toBeGreaterThan(previous.x);
      // The counter keeps the build-time digits, also after a turn.
      const digits = (await reader(page).getAttribute('data-digits'))!;
      const before = (await page.locator('[data-book-counter-long]').textContent())!;
      await stage(page).focus();
      await page.keyboard.press('ArrowRight');
      await expectShown(page, ['2', '3']);
      const after = (await page.locator('[data-book-counter-long]').textContent())!;
      for (const text of [before, after]) expect(text.replace(new RegExp(`[^${digits}]`, 'g'), '').length).toBeGreaterThan(2);
      if (digits !== '0123456789') expect(after).not.toMatch(/[0-9]/);
    });
  }
});

test.describe('without JavaScript', () => {
  test.use({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });

  test('renders every page in order, with the contents and the download', async ({ page }) => {
    await page.goto('/book');
    const pages = page.locator('.book__page');
    await expect(pages).toHaveCount(manifest.pageCount);
    const tops = await pages.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
    expect(tops.every((top, i) => i === 0 || top > tops[i - 1]!)).toBe(true);
    await page.locator('.book-inside [data-book-chapter="5"]').click();
    expect(new URL(page.url()).hash).toBe(`#page-${chapter(5).start}`);
    await expect(page.locator(`#page-${chapter(5).start}`)).toBeInViewport();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.book-intro [data-book-download]').click()]);
    expect(download.suggestedFilename()).toBe('Reya-Kurmanci-Pirtuka-Hevalo.pdf');
  });
});

test.describe('failures', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('reports an image that fails to load and offers a reload', async ({ page }) => {
    await settled(page.context());
    await page.route(/\/p\d{3}-(720|1440)\.[\w-]+\.webp$/, (route) => route.abort());
    await page.goto('/book');
    await expect(page.locator('[data-book-notice]')).toBeVisible();
    await expect(page.locator('[data-book-reload]')).toBeVisible();
  });

  test('falls back to the page column when the reader cannot start', async ({ page }) => {
    await settled(page.context());
    await page.addInitScript(() => {
      // The reader requires ResizeObserver to track its stage size.
      Object.defineProperty(window, 'ResizeObserver', { value: undefined });
    });
    await page.goto('/book', { waitUntil: 'networkidle' });
    await expect(reader(page)).toHaveAttribute('data-book', 'off');
    await expect(page.locator('#page-2')).toBeVisible();
  });
});

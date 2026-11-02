/**
 * The paper plane under the rug: it stays there until it is found (the rug
 * lifted), and until then the proverb's sheet simply lies where it is. Found,
 * it flies over the page while the page is scrolled down to the proverb and,
 * once the sheet is in sight, lands there and opens into it, the sheet whole
 * on the screen under the header; scrolled back up, it flies home. The
 * proverb is in the page as text all the while, for screen readers and
 * search; with reduced motion the sheet simply lies there. The plane never
 * makes the page scroll sideways, and nothing goes wrong on the way.
 */
import { type Page, expect, test } from '@playwright/test';
import { settled, watch } from './support';

const proverb = (page: Page) => page.locator('[data-proverb]');
const sheet = (page: Page) => page.locator('[data-sheet]');
const flight = (page: Page) => page.locator('[data-plane]');
const rug = (page: Page) => page.locator('[data-rug]');

/** The page scrolled so the rug (0) or the sheet (1), or a share of the way between, is in the middle of the screen. */
async function scrollShare(page: Page, share: number) {
  await page.evaluate((share) => {
    const middle = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return box.top + scrollY + box.height / 2 - innerHeight / 2;
    };
    const from = middle('[data-rug]');
    // At once: the page scrolls smoothly otherwise, and would still be on its way.
    window.scrollTo({ top: from + (middle('[data-sheet]') - from) * share, behavior: 'instant' });
  }, share);
}

/** Lifts the rug with its button, once the 3D rug is woven and at rest. */
async function lift(page: Page) {
  await expect
    .poll(() => rug(page).evaluate((element) => element.hasAttribute('data-live') && element.getAttribute('data-state') === 'resting'), {
      timeout: 60_000,
    })
    .toBe(true);
  await page.getByRole('button', { name: 'Lift the rug' }).click();
  await expect(rug(page)).toHaveAttribute('data-lifted', '');
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`at ${viewport.width}px, found, it flies from under the rug to the proverb and back`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await settled(page.context());
    const problems = await watch(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await rug(page).scrollIntoViewIfNeeded();
    await scrollShare(page, 0);
    await lift(page);
    await expect(proverb(page), 'found, the plane takes the proverb').toHaveAttribute('data-flight', '');
    await expect(flight(page), 'it lies under the rug').not.toHaveAttribute('data-aloft');
    await expect(sheet(page)).toHaveCSS('opacity', '0');

    await scrollShare(page, 0.5);
    await expect(flight(page), 'it flies over the page').toHaveAttribute('data-aloft', '');
    await expect(page.getByText('Dar li ser koka xwe', { exact: false }), 'the proverb is still in the page').toHaveCount(1);

    // In sight, it lands and opens by itself, and the sheet fits under the header, whole.
    await scrollShare(page, 1);
    await expect(proverb(page), 'it lands').toHaveAttribute('data-landed', '', { timeout: 10_000 });
    await expect(sheet(page)).toHaveCSS('opacity', '1');
    await expect(flight(page)).toBeHidden();
    const box = (await sheet(page).boundingBox())!;
    const header = (await page.locator('.site-header').boundingBox())!;
    expect(box.y, 'the sheet is clear of the header').toBeGreaterThanOrEqual(header.y + header.height);
    expect(box.y + box.height, 'and on the screen').toBeLessThanOrEqual(viewport.height);

    await scrollShare(page, 0);
    await expect(proverb(page), 'scrolled back, it flies home').not.toHaveAttribute('data-landed');
    await expect(flight(page)).not.toHaveAttribute('data-aloft', { timeout: 10_000 });

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways, 'the page never scrolls sideways').toBeLessThanOrEqual(0);
    expect(problems).toEqual([]);
  });
}

test('not found, it stays under the rug and the sheet simply lies there', async ({ page }) => {
  await settled(page.context());
  await page.goto('/', { waitUntil: 'networkidle' });
  await rug(page).scrollIntoViewIfNeeded();
  await scrollShare(page, 0.5);
  await expect(flight(page)).not.toHaveAttribute('data-aloft');
  await scrollShare(page, 1);
  await expect(proverb(page)).not.toHaveAttribute('data-flight');
  await expect(sheet(page)).toHaveCSS('opacity', '1');
  await expect(sheet(page).getByText('A tree thrives through its roots', { exact: false })).toBeVisible();
});

test('with reduced motion, the proverb simply lies there', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settled(page.context());
  await page.goto('/', { waitUntil: 'networkidle' });
  await rug(page).scrollIntoViewIfNeeded();
  await lift(page);
  await sheet(page).scrollIntoViewIfNeeded();
  await expect(proverb(page)).not.toHaveAttribute('data-flight');
  await expect(sheet(page)).toHaveCSS('opacity', '1');
  await expect(sheet(page).getByText('A tree thrives through its roots', { exact: false })).toBeVisible();
});

test('the button lifts the rug and lays it back, saying which it will do', async ({ page }) => {
  await settled(page.context());
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Lift the rug' }).scrollIntoViewIfNeeded();
  await lift(page);
  await expect(page.getByRole('button', { name: 'Lay it back' })).toBeVisible();
});

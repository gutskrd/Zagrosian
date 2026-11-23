/**
 * Paper plane under the rug: it stays hidden until the rug has been lifted, and until then the
 * proverb sheet is static. Once revealed, it flies over the page while scrolling toward the
 * proverb, lands and unfolds into the sheet once it's visible (fully on screen below the header),
 * and flies back when scrolling up. The proverb stays in the document as text throughout, for
 * screen readers and search; with reduced motion the sheet is static. The plane never causes
 * horizontal scrolling or errors.
 */
import { type Page, expect, test } from '@playwright/test';
import { settled, watch } from './support';

const proverb = (page: Page) => page.locator('[data-proverb]');
const sheet = (page: Page) => page.locator('[data-sheet]');
const flight = (page: Page) => page.locator('[data-plane]');
const rug = (page: Page) => page.locator('[data-rug]');

/** Scrolls so the rug (0), the sheet (1), or a point between them is centered in the viewport. */
async function scrollShare(page: Page, share: number) {
  await page.evaluate((share) => {
    const middle = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return box.top + scrollY + box.height / 2 - innerHeight / 2;
    };
    const from = middle('[data-rug]');
    // Instant: smooth scrolling would still be in progress.
    window.scrollTo({ top: from + (middle('[data-sheet]') - from) * share, behavior: 'instant' });
  }, share);
}

/** Lifts the rug via its button once the 3D rug has loaded and settled. */
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
  test(`flies from under the rug to the proverb and back once found, at ${viewport.width}px`, async ({ page }) => {
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

    // Once visible, it lands and unfolds on its own, and the sheet fits fully below the header.
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

test('stays under the rug until the rug is lifted', async ({ page }) => {
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

test('leaves the proverb static with reduced motion', async ({ page }) => {
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

test('lift button toggles the rug and updates its label', async ({ page }) => {
  await settled(page.context());
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Lift the rug' }).scrollIntoViewIfNeeded();
  await lift(page);
  await expect(page.getByRole('button', { name: 'Lay it back' })).toBeVisible();
});

/**
 * Nothing jumps: no layout shift while the homepage loads (with its loading
 * screen, as on a first visit), and none while it is scrolled all the way down
 * with a mouse wheel and back up again, through the story and the deer, left
 * to right and right to left (where the browser measures from the right).
 */
import { type Page, expect, test } from '@playwright/test';
import { settled } from './support';

/** Adds up every layout shift on the page from its next navigation on. */
async function measureShifts(page: Page) {
  await page.addInitScript(() => {
    const record = window as unknown as { shifts: { value: number; at: number; source: string }[] };
    record.shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] }[]) {
        const node = entry.sources?.[0]?.node;
        const source = node instanceof Element ? `${node.localName}.${node.className.toString().split(' ')[0]}` : (node?.nodeName ?? '?');
        record.shifts.push({ value: entry.value, at: Math.round(scrollY), source });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  return async () => {
    const shifts = await page.evaluate(() => (window as unknown as { shifts: { value: number; at: number; source: string }[] }).shifts);
    return {
      total: shifts.reduce((sum, shift) => sum + shift.value, 0),
      where: shifts.map((shift) => `${shift.source} at ${shift.at}px: ${shift.value.toFixed(4)}`),
    };
  };
}

const screens = [
  { name: 'phone', viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true },
  { name: 'computer', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
];

for (const { name, ...screen } of screens) {
  test.describe(`loading, on a ${name}`, () => {
    test.use(screen);

    for (const path of ['/', '/fa', '/de']) {
      test(path, async ({ page }) => {
        const shifts = await measureShifts(page);
        await page.goto(path, { waitUntil: 'networkidle' });
        // Until the loading screen has lifted and the page has settled.
        await page.waitForTimeout(5000);
        const { total, where } = await shifts();
        expect(total, where.join('\n')).toBeLessThan(0.01);
      });
    }
  });
}

for (const { width, height, path } of [
  { width: 1440, height: 900, path: '/' },
  { width: 390, height: 844, path: '/' },
  { width: 1280, height: 800, path: '/ar' },
  { width: 390, height: 844, path: '/fa' },
]) {
  test(`scrolling down and back up: ${path} at ${width} wide`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await settled(page.context());
    const shifts = await measureShifts(page);
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.mouse.move(width / 2, height / 2);
    const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y < end + 200; y += 120) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(800);
    for (let y = end; y > -200; y -= 120) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(800);
    const { total, where } = await shifts();
    expect(total, where.join('\n')).toBeLessThan(0.01);
  });
}

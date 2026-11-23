/** Shared test helpers and page lists (tests/*.spec.ts). */
import type { BrowserContext, Page } from '@playwright/test';
import { defaultLocale, locales } from '../src/i18n/locales';

export { locales };

/** Locale URL prefix; none for English. */
export const prefix = (code: string) => (code === defaultLocale ? '' : `/${code}`);

/** A locale's pages: homepage, book and legal pages. */
export const pagesIn = (code: string) => [prefix(code) || '/', `${prefix(code)}/book`, `${prefix(code)}/privacy`, `${prefix(code)}/terms`, `${prefix(code)}/security`];

/** Every page in every locale. */
export const pages = locales.flatMap(({ code }) => pagesIn(code));

/** A nonexistent page per locale (renders the 404 page). */
export const missing = locales.map(({ code }) => `${prefix(code)}/no-such-page`);

/**
 * Marks a language as chosen and sound as off, so neither the language suggestion nor the sound
 * prompt appears.
 */
export async function settled(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('language-chosen', '1');
      localStorage.setItem('sound', 'off');
    } catch {
      // Storage may be unavailable; the page then behaves as on a first visit.
    }
  });
}

/** Collects CSP violations, console errors and uncaught exceptions from the next navigation on. */
export async function watch(page: Page) {
  const problems: string[] = [];
  await page.context().exposeBinding('reportViolation', ({ frame }, violation: string) => {
    problems.push(`CSP @ ${frame.url()}: ${violation}`);
  });
  await page.context().addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { reportViolation: (text: string) => void }).reportViolation;
      report(`${event.violatedDirective} blocked ${event.blockedURI} (${event.sourceFile}:${event.lineNumber})`);
    });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console @ ${page.url()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`error @ ${page.url()}: ${error.message}`));
  return problems;
}

/** Scrolls from top to bottom, one viewport at a time. */
export async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  });
}

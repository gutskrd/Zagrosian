/**
 * Shared by the site's checks (tests/*.spec.ts): its pages, and helpers.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { defaultLocale, locales } from '../src/i18n/locales';

export { locales };

/** A language's URL prefix: none for English. */
export const prefix = (code: string) => (code === defaultLocale ? '' : `/${code}`);

/** A language's pages: the homepage and the legal pages. */
export const pagesIn = (code: string) => [prefix(code) || '/', `${prefix(code)}/privacy`, `${prefix(code)}/terms`, `${prefix(code)}/security`];

/** Every page in every language. */
export const pages = locales.flatMap(({ code }) => pagesIn(code));

/** A page that does not exist, in every language (the 404 page). */
export const missing = locales.map(({ code }) => `${prefix(code)}/no-such-page`);

/** With a language chosen and sound off: no language suggestion or sound prompt. */
export async function settled(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('language-chosen', '1');
      localStorage.setItem('sound', 'off');
    } catch {
      // Storage can be unavailable; the page then behaves as on a first visit.
    }
  });
}

/**
 * Collects Content-Security-Policy violations, console errors and uncaught
 * errors on a page, from its next navigation on.
 */
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

/** Scrolls a page from top to bottom, a screen's worth at a time. */
export async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  });
}

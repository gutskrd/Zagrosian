/**
 * i18n helpers. Pages and components derive their locale from the URL, so nothing needs to be
 * passed down: `const { t, localize } = i18n(Astro.url)`.
 */
import { defaultLocale, isLocale, localeInfo, type Locale } from './locales';
import { ar } from './messages/ar';
import { ckb } from './messages/ckb';
import { de } from './messages/de';
import { en, type Messages } from './messages/en';
import { es } from './messages/es';
import { fa } from './messages/fa';
import { fr } from './messages/fr';
import { ku } from './messages/ku';
import { nl } from './messages/nl';
import { tr } from './messages/tr';

export * from './locales';
export type { Messages };

/** Legal page slugs, identical in every locale (/privacy, /de/privacy). */
export const legalSlugs = ['privacy', 'terms', 'security'] as const;
export type LegalSlug = (typeof legalSlugs)[number];

const catalogues: Record<Locale, Messages> = { en, ku, ckb, nl, de, es, fr, tr, ar, fa };

export const messages = (locale: Locale): Messages => catalogues[locale];

/** Strips `.html` and a trailing `index`: /de/privacy.html -> /de/privacy. */
const cleanPath = (pathname: string) => pathname.replace(/(index)?\.html$/, '').replace(/(.)\/$/, '$1') || '/';

export function localeFromPath(pathname: string): Locale {
  const first = cleanPath(pathname).split('/')[1];
  return isLocale(first) && first !== defaultLocale ? first : defaultLocale;
}

/** English path of a page, without the locale prefix: /de/privacy -> /privacy, /de -> /. */
export function basePath(pathname: string): string {
  const path = cleanPath(pathname);
  const locale = localeFromPath(path);
  if (locale === defaultLocale) return path;
  return path.slice(locale.length + 1) || '/';
}

/**
 * Localizes an English path, optionally with a fragment: ('de', '/') -> /de, ('de', '/privacy') ->
 * /de/privacy, ('de', '/#about') -> /de#about.
 */
export function localizePath(locale: Locale, path: string): string {
  if (locale === defaultLocale) return path;
  const [pathname, hash] = path.split('#');
  const localized = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
  return hash === undefined ? localized : `${localized}#${hash}`;
}

/** Everything a page or component needs to render in its locale. */
export function i18n(url: URL) {
  const locale = localeFromPath(url.pathname);
  return {
    locale,
    info: localeInfo(locale),
    t: messages(locale),
    /** Current page's English path, for linking to it in other locales. */
    base: basePath(url.pathname),
    localize: (path: string) => localizePath(locale, path),
  };
}

export interface NavLink {
  label: string;
  href: string;
}

/** Homepage section link, with the key of its label in `nav`. */
export interface SectionLink extends NavLink {
  key: 'hevalo' | 'about' | 'faq' | 'contact';
}

/** Site navigation for a locale: homepage sections, the book and the legal pages. */
export function navigation(locale: Locale) {
  const t = messages(locale);
  const link = (label: string, path: string): NavLink => ({ label, href: localizePath(locale, path) });
  return {
    home: link(t.nav.home, '/'),
    book: link(t.nav.book, '/book'),
    sections: (['hevalo', 'about', 'faq', 'contact'] as const).map(
      (key): SectionLink => ({ key, ...link(t.nav[key], `/#${key}`) }),
    ),
    legal: legalSlugs.map((slug) => link(t.nav[slug], `/${slug}`)),
  };
}

/** Fills `{name}` placeholders: format('{email} copied', { email: 'a@b' }). */
export const format = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);

/**
 * Unit strings that CLDR lacks or renders unusually (e.g. English CLDR now says "8 mins", where "8
 * min read" is the norm).
 */
const minuteFallback: Partial<Record<Locale, string>> = { en: '{n} min', ckb: '{n} خولەک' };

/** Localized minutes: "6 min", "6 Min.", "6 دقائق", "٦ خولەک". */
export function formatMinutes(locale: Locale, minutes: number, unitDisplay: 'short' | 'long'): string {
  const fallback = minuteFallback[locale];
  const { intl } = localeInfo(locale);
  if (fallback) return format(fallback, { n: new Intl.NumberFormat(intl).format(minutes) });
  return new Intl.NumberFormat(intl, { style: 'unit', unit: 'minute', unitDisplay }).format(minutes);
}

/**
 * Localized date: "17 November 2026", "17. November 2026". For non-Gregorian calendars (Persian
 * uses Solar Hijri), the Gregorian date follows in parentheses so it can be compared with the
 * English original: "۲۶ آبان ۱۴۰۵ (۱۷ نوامبر ۲۰۲۶)".
 */
export function formatDate(locale: Locale, date: Date | string): string {
  const day = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : date;
  const options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } as const;
  const { intl } = localeInfo(locale);
  const local = new Intl.DateTimeFormat(intl, options);
  if (local.resolvedOptions().calendar === 'gregory') return local.format(day);
  return `${local.format(day)} (${new Intl.DateTimeFormat(`${intl}-u-ca-gregory`, options).format(day)})`;
}

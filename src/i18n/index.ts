/**
 * Language helpers. Pages and components find their language from the URL, so
 * nothing has to be passed down: `const { t, localize } = i18n(Astro.url)`.
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

/** The legal pages, by their path in every language (/privacy, /de/privacy). */
export const legalSlugs = ['privacy', 'terms', 'security'] as const;
export type LegalSlug = (typeof legalSlugs)[number];

const catalogues: Record<Locale, Messages> = { en, ku, ckb, nl, de, es, fr, tr, ar, fa };

export const messages = (locale: Locale): Messages => catalogues[locale];

/** A page's path without `.html` and without a trailing `index`: /de/privacy.html → /de/privacy. */
const cleanPath = (pathname: string) => pathname.replace(/(index)?\.html$/, '').replace(/(.)\/$/, '$1') || '/';

export function localeFromPath(pathname: string): Locale {
  const first = cleanPath(pathname).split('/')[1];
  return isLocale(first) && first !== defaultLocale ? first : defaultLocale;
}

/** The English path of a page, with any language prefix removed: /de/privacy → /privacy, /de → /. */
export function basePath(pathname: string): string {
  const path = cleanPath(pathname);
  const locale = localeFromPath(path);
  if (locale === defaultLocale) return path;
  return path.slice(locale.length + 1) || '/';
}

/**
 * A path in the given language. `path` is the English path, optionally with a
 * fragment: ('de', '/') → /de, ('de', '/privacy') → /de/privacy, ('de', '/#about') → /de#about.
 */
export function localizePath(locale: Locale, path: string): string {
  if (locale === defaultLocale) return path;
  const [pathname, hash] = path.split('#');
  const localized = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
  return hash === undefined ? localized : `${localized}#${hash}`;
}

/** Everything a page or component needs to render in its language. */
export function i18n(url: URL) {
  const locale = localeFromPath(url.pathname);
  return {
    locale,
    info: localeInfo(locale),
    t: messages(locale),
    /** The current page's English path, for linking to it in other languages. */
    base: basePath(url.pathname),
    localize: (path: string) => localizePath(locale, path),
  };
}

export interface NavLink {
  label: string;
  href: string;
}

/** A section of the homepage, with the key of its label in `nav`. */
export interface SectionLink extends NavLink {
  key: 'hevalo' | 'about' | 'faq' | 'contact';
}

/** The site's links in a language: the homepage sections and the legal pages. */
export function navigation(locale: Locale) {
  const t = messages(locale);
  const link = (label: string, path: string): NavLink => ({ label, href: localizePath(locale, path) });
  return {
    home: link(t.nav.home, '/'),
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
 * Unit wording that the Unicode locale data (CLDR) lacks, or gives in a less
 * usual form: English data now says "8 mins", where "8 min read" is the norm.
 */
const minuteFallback: Partial<Record<Locale, string>> = { en: '{n} min', ckb: '{n} خولەک' };

/** A number of minutes in a language: "6 min", "6 Min.", "6 دقائق", "٦ خولەک". */
export function formatMinutes(locale: Locale, minutes: number, unitDisplay: 'short' | 'long'): string {
  const fallback = minuteFallback[locale];
  const { intl } = localeInfo(locale);
  if (fallback) return format(fallback, { n: new Intl.NumberFormat(intl).format(minutes) });
  return new Intl.NumberFormat(intl, { style: 'unit', unit: 'minute', unitDisplay }).format(minutes);
}

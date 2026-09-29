/**
 * The site's languages: the same nine as Hevalo, in the same order. English is
 * the default and lives at the root (/, /privacy); every other language has
 * its own prefix (/de, /de/privacy).
 */
export const locales = [
  { code: 'ku', name: 'Kurdî (Kurmancî)', englishName: 'Kurmanji Kurdish', dir: 'ltr', ogLocale: 'ku_TR' },
  { code: 'ckb', name: 'کوردی (سۆرانی)', englishName: 'Sorani Kurdish', dir: 'rtl', ogLocale: 'cb_IQ' },
  { code: 'en', name: 'English', englishName: 'English', dir: 'ltr', ogLocale: 'en_GB' },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', dir: 'ltr', ogLocale: 'nl_NL' },
  { code: 'de', name: 'Deutsch', englishName: 'German', dir: 'ltr', ogLocale: 'de_DE' },
  { code: 'es', name: 'Español', englishName: 'Spanish', dir: 'ltr', ogLocale: 'es_ES' },
  { code: 'fr', name: 'Français', englishName: 'French', dir: 'ltr', ogLocale: 'fr_FR' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', dir: 'ltr', ogLocale: 'tr_TR' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', dir: 'rtl', ogLocale: 'ar_AR' },
] as const;

export type Locale = (typeof locales)[number]['code'];
export type LocaleInfo = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Every language except English, which has no URL prefix. */
export const prefixedLocales = locales.filter((locale) => locale.code !== defaultLocale).map((locale) => locale.code);

export const isLocale = (value: string | undefined): value is Locale =>
  locales.some((locale) => locale.code === value);

export const localeInfo = (code: Locale): LocaleInfo => locales.find((locale) => locale.code === code)!;

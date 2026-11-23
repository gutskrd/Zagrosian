/**
 * Supported locales: Hevalo's nine, in the same order, plus Persian. English is the default and
 * unprefixed (/, /privacy); every other locale is prefixed (/de, /de/privacy). `intl` is the locale
 * used for dates and numbers; the site's English is British ("29 September 2026").
 */
export const locales = [
  { code: 'ku', name: 'Kurdî (Kurmancî)', englishName: 'Kurmanji Kurdish', dir: 'ltr', ogLocale: 'ku_TR', intl: 'ku' },
  { code: 'ckb', name: 'کوردی (سۆرانی)', englishName: 'Sorani Kurdish', dir: 'rtl', ogLocale: 'cb_IQ', intl: 'ckb' },
  { code: 'en', name: 'English', englishName: 'English', dir: 'ltr', ogLocale: 'en_GB', intl: 'en-GB' },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', dir: 'ltr', ogLocale: 'nl_NL', intl: 'nl' },
  { code: 'de', name: 'Deutsch', englishName: 'German', dir: 'ltr', ogLocale: 'de_DE', intl: 'de' },
  { code: 'es', name: 'Español', englishName: 'Spanish', dir: 'ltr', ogLocale: 'es_ES', intl: 'es' },
  { code: 'fr', name: 'Français', englishName: 'French', dir: 'ltr', ogLocale: 'fr_FR', intl: 'fr' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', dir: 'ltr', ogLocale: 'tr_TR', intl: 'tr' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', dir: 'rtl', ogLocale: 'ar_AR', intl: 'ar' },
  { code: 'fa', name: 'فارسی', englishName: 'Persian (Farsi)', dir: 'rtl', ogLocale: 'fa_IR', intl: 'fa' },
] as const;

export type Locale = (typeof locales)[number]['code'];
export type LocaleInfo = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Every locale except English (which has no URL prefix). */
export const prefixedLocales = locales.filter((locale) => locale.code !== defaultLocale).map((locale) => locale.code);

export const isLocale = (value: string | undefined): value is Locale => locales.some((locale) => locale.code === value);

export const localeInfo = (code: Locale): LocaleInfo => locales.find((locale) => locale.code === code)!;

/**
 * Company details that are the same in every language: names, addresses and
 * links. Text for visitors is in src/i18n/messages/<language>.ts.
 */

export interface SocialProfile {
  label: string;
  handle: string;
  url: string;
  icon: 'instagram' | 'tiktok';
}

export const site = {
  name: 'Zagrosian',
  /** Name used in legal documents. Update when the company is registered. */
  legalName: 'Zagrosian',
  url: 'https://zagrosian.com',
  /**
   * Date of the homepage's last material change (YYYY-MM-DD), for the sitemap.
   * Update it when the homepage's text changes.
   */
  updated: '2026-10-01',
  /**
   * IndexNow key, which lets the site tell search engines about changed pages
   * (`npm run indexnow`). It is public by design: public/<key>.txt holds it, to
   * show the site owns it.
   */
  indexNowKey: '7c9302be7e61891041f0aa00b0435b84',
  /** Headquarters, as an ISO 3166 country code. */
  country: 'NL',
  /** The headquarters' time zone, for the local time shown in About. */
  timeZone: 'Europe/Amsterdam',
  /**
   * Addresses shown on the site. privacy@, legal@ and careers@ appear only in the
   * legal pages (src/content/legal), where they are written out.
   */
  emails: {
    /** Main contact: shown in the Contact section and used for security reports. */
    contact: 'contact@zagrosian.com',
    press: 'press@zagrosian.com',
  },
};

export const hevalo = {
  name: 'Hevalo',
  url: 'https://hevalo.app',
  domain: 'hevalo.app',
  /** Hevalo's own logo, for structured data. */
  logo: 'https://hevalo.app/logo.png',
};

/**
 * Kurdish phrases that belong to the brand and stay in Kurmanji in every
 * language, each with a translation in the message files.
 */
export const kurdish = {
  /** Hevalo's motto, "Life is sweeter in Kurdish": the end of the homepage story (`motto`). */
  motto: 'Jiyan bi kurdî xweştire.',
  /** "Thank you", literally "may your home prosper": the footer (`footer.thanks`). */
  thanks: 'Mala we ava.',
  /** A proverb, shown with Hevalo (`hevalo.proverb`). */
  proverb: 'Dar li ser koka xwe, mirov li ser zimanê xwe şîn dibe.',
  /** "Proverb" (literally "a saying of the forebears"), the proverb's credit. */
  proverbSource: 'Gotina pêşiyan',
};

export const socialProfiles: SocialProfile[] = [
  { label: 'Instagram', handle: 'zagrosiano', url: 'https://www.instagram.com/zagrosiano/', icon: 'instagram' },
  { label: 'TikTok', handle: 'zagrosianofficial', url: 'https://www.tiktok.com/@zagrosianofficial', icon: 'tiktok' },
];

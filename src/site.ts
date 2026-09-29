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

/** Kurdish phrases that belong to the brand and stay in Kurmanji in every language. */
export const kurdish = {
  motto: 'Jiyan bi kurdî xweştire.',
  footer: 'Ji Kurdan, ji bo Kurdan.',
};

export const socialProfiles: SocialProfile[] = [
  { label: 'Instagram', handle: 'zagrosiano', url: 'https://www.instagram.com/zagrosiano/', icon: 'instagram' },
  { label: 'TikTok', handle: 'zagrosianofficial', url: 'https://www.tiktok.com/@zagrosianofficial', icon: 'tiktok' },
];

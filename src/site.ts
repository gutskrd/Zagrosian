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

/** A registered address, in the Dutch order: street and number, postcode, place. */
export interface PostalAddress {
  /** Street and house number. */
  street: string;
  /** Postcode: four digits and two letters, such as "1234 AB". */
  postalCode: string;
  /** Place. */
  city: string;
}

/** The company's registration, as the registers have issued it. */
export interface Registration {
  /** The registered address (the one in the trade register). */
  address?: PostalAddress;
  /** The number in the Dutch trade register (the KvK number): eight digits. */
  kvk?: string;
  /** The VAT identification number (btw-id), such as "NL000000000B01". */
  vat?: string;
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
  updated: '2026-10-06',
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

/**
 * The company's registration. A company in the EU that offers services online
 * shows its registered address, trade register number and VAT number on its
 * site (Directive 2000/31/EC, article 5; in the Netherlands, Burgerlijk Wetboek
 * 3:15d). Each detail is shown in every footer (Footer.astro) and added to the
 * structured data (src/lib/structured-data.ts) as soon as it is filled in here;
 * until then nothing is shown. Fill in only what the Chamber of Commerce (KVK)
 * and the tax office have issued, and update `site.legalName` to the registered
 * name with them.
 */
export const registration: Registration = {};

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
  { label: 'Instagram', handle: 'zagrosian_official', url: 'https://www.instagram.com/zagrosian_official/', icon: 'instagram' },
  { label: 'TikTok', handle: 'zagrosianofficial', url: 'https://www.tiktok.com/@zagrosianofficial', icon: 'tiktok' },
];

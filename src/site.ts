/**
 * Locale-independent site configuration: company details, identifiers and links. User-facing copy
 * lives in src/i18n/messages/<locale>.ts.
 */

export interface SocialProfile {
  label: string;
  handle: string;
  url: string;
  icon: 'instagram' | 'tiktok';
}

/** Registered address in Dutch order: street and number, postcode, city. */
export interface PostalAddress {
  /** Street and house number. */
  street: string;
  /** Postcode: four digits and two letters, e.g. "1234 AB". */
  postalCode: string;
  /** City. */
  city: string;
}

/** Company registration details, exactly as issued. */
export interface Registration {
  /** Registered address (as in the trade register). */
  address?: PostalAddress;
  /** Dutch trade register (KvK) number: eight digits. */
  kvk?: string;
  /** VAT identification number (btw-id), e.g. "NL000000000B01". */
  vat?: string;
  /** Registered phone number in international format, e.g. "+31 6 12345678". */
  phone?: string;
}

export const site = {
  name: 'Zagrosian',
  /** Legal name: the trade name as registered with the KvK. */
  legalName: 'Zagrosian',
  url: 'https://zagrosian.com',
  /**
   * Last material change to the homepage (YYYY-MM-DD), used as its sitemap `lastmod`. Bump it when
   * the homepage copy changes.
   */
  updated: '2026-11-17',
  /**
   * IndexNow key (`npm run indexnow`). Public by design: public/<key>.txt proves ownership of the
   * domain.
   */
  indexNowKey: '7c9302be7e61891041f0aa00b0435b84',
  /** Headquarters country (ISO 3166-1 alpha-2). */
  country: 'NL',
  /** Headquarters time zone, for the local time shown in About. */
  timeZone: 'Europe/Amsterdam',
  /**
   * Public email addresses. Only monitored inboxes are listed: contact@ for everything (general,
   * partnerships, press, legal, jobs, security reports), and privacy@, which appears only in the
   * privacy policy (src/content/legal) because data-subject requests have a statutory deadline.
   */
  emails: {
    /** Primary contact, shown in the Contact section and used for security reports. */
    contact: 'contact@zagrosian.com',
  },
};

/**
 * Company registration. EU businesses offering online services must display their registered
 * address, trade register number and VAT number (Directive 2000/31/EC art. 5; Dutch Civil Code
 * 3:15d). Each field appears in the footer once set here.
 *
 * These details are shown to visitors but kept out of search: they're not in the HTML or the
 * structured data. The footer loads them from /registration.json (src/scripts/registration.ts),
 * which robots.txt disallows. Only enter what the KvK and the tax office have issued, and keep
 * `site.legalName` in sync.
 *
 * Zagrosian is registered as a sole proprietorship (eenmanszaak) with the trade names Zagrosian and
 * Hevalo. The VAT ID hasn't been issued yet. If the address is ever shielded in the register,
 * replace it here with the registered public postal address.
 */
export const registration: Registration = {
  address: { street: 'Westerengstraat 7', postalCode: '6669 BE', city: 'Dodewaard' },
  kvk: '42217689',
  phone: '+31 6 38066158',
};

/**
 * Hevalo's book: page path, PDF path and download filename (matching hevalo.app), share image
 * (rendered by scripts/book.mjs), and the first-publication date, which later editions keep
 * (`datePublished` in structured data). The edition itself lives in src/assets/book/ (imported by
 * scripts/book.mjs, read by src/lib/book.ts).
 */
export const book = {
  path: '/book',
  pdf: '/book/reya-kurmanci.pdf',
  fileName: 'Reya-Kurmanci-Pirtuka-Hevalo.pdf',
  shareImage: '/og/book.jpg',
  published: '2026-11-17',
};

export const hevalo = {
  name: 'Hevalo',
  url: 'https://hevalo.app',
  domain: 'hevalo.app',
  /** Hevalo's logo, for structured data. */
  logo: 'https://hevalo.app/logo.png',
};

/** Brand phrases kept in Kurmanji in every locale; translations live in the message files. */
export const kurdish = {
  /** Hevalo's motto, "Life is sweeter in Kurdish"; closes the homepage story (`motto`). */
  motto: 'Jiyan bi kurdî xweştire.',
  /** "Thank you" (literally "may your home prosper"); footer (`footer.thanks`). */
  thanks: 'Mala we ava.',
  /**
   * Proverb written on the sheet the paper plane unfolds into (Proverb.astro); translation in
   * `hevalo.proverb`.
   */
  proverb: 'Dar li ser koka xwe, mirov li ser zimanê xwe şîn dibe.',
  /** Attribution for the proverb: "a saying of the forebears". */
  proverbSource: 'Gotina pêşiyan',
  /** Title of Hevalo's book, "The Kurmanji Road" (`book.subtitle`). */
  book: 'Rêya Kurmancî',
};

export const socialProfiles: SocialProfile[] = [
  { label: 'Instagram', handle: 'zagrosian_official', url: 'https://www.instagram.com/zagrosian_official/', icon: 'instagram' },
  { label: 'TikTok', handle: 'zagrosianofficial', url: 'https://www.tiktok.com/@zagrosianofficial', icon: 'tiktok' },
];

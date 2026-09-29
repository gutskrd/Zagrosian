export interface Product {
  name: string;
  url: string;
  /** The product's own logo, for structured data. */
  logo: string;
  category: string;
  description: string;
  /** Where the product is available now, and what is coming. */
  availability: { web: string; comingSoon: string[]; comingSoonNote: string };
}

export interface SocialProfile {
  label: string;
  handle: string;
  url: string;
  icon: 'instagram' | 'tiktok';
}

export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface SiteConfig {
  name: string;
  /** Name used in legal documents. Update when the company is registered. */
  legalName: string;
  url: string;
  country: string;
  tagline: string;
  title: string;
  description: string;
  /**
   * Addresses shown on the site. privacy@, legal@ and careers@ appear only in the
   * legal pages (src/pages/*.md), where they are written out.
   */
  emails: {
    /** Main contact: shown in the Contact section and used for security reports. */
    contact: string;
    press: string;
  };
  products: Product[];
}

export const hevalo: Product = {
  name: 'Hevalo',
  url: 'https://hevalo.app',
  logo: 'https://hevalo.app/logo.png',
  category: 'Kurdish language learning',
  description:
    'An app for learning Kurdish through short lessons and games played with friends. Available first in Kurmanji, with more dialects planned.',
  availability: {
    web: 'hevalo.app',
    comingSoon: ['iOS', 'Android'],
    comingSoonNote: 'The native apps are in development and will be available on the App Store and Google Play.',
  },
};

export const site: SiteConfig = {
  name: 'Zagrosian',
  legalName: 'Zagrosian',
  url: 'https://zagrosian.com',
  country: 'the Netherlands',
  tagline: 'Technology for everyday life.',
  title: 'Zagrosian — Technology for everyday life',
  description:
    'Zagrosian is an independent technology company based in the Netherlands. We design and build consumer products, starting with Hevalo, an app for learning Kurdish.',
  emails: {
    contact: 'contact@zagrosian.com',
    press: 'press@zagrosian.com',
  },
  products: [hevalo],
};

/** Where the company is based, as a standalone name ("Netherlands"). */
export const headquarters = site.country.replace(/^the /, '');

/**
 * Homepage copy. The page, its Markdown version (/index.md) and /llms.txt are all
 * built from this, so they always say the same thing.
 */
export const home = {
  headline: ['Technology for', 'everyday life.'],
  lead: `${site.name} is an independent technology company based in ${site.country}. We design and build consumer products, starting with ${hevalo.name}, an app for learning Kurdish.`,
  motto: { ku: 'Jiyan bi kurdî xweştire.', en: 'Life is sweeter in Kurdish.' },
  mission: 'Our mission is to build software people enjoy using every day: fast, private and well designed.',
  approach: `${site.name} is privately owned. We design and build our products in-house.`,
  contact: 'For general enquiries and partnerships, please contact us by email.',
  footerMotto: { ku: 'Ji Kurdan, ji bo Kurdan.', en: 'By Kurds, for Kurds.' },
};

export const socialProfiles: SocialProfile[] = [
  { label: 'Instagram', handle: 'zagrosiano', url: 'https://www.instagram.com/zagrosiano/', icon: 'instagram' },
  { label: 'TikTok', handle: 'zagrosianofficial', url: 'https://www.tiktok.com/@zagrosianofficial', icon: 'tiktok' },
];

export const primaryNav: NavLink[] = [
  { label: 'Hevalo', href: '/#hevalo' },
  { label: 'About', href: '/#about' },
  { label: 'Contact', href: '/#contact' },
];

export const footerNav: NavLink[] = [
  { label: 'Hevalo', href: hevalo.url, external: true },
  { label: 'About', href: '/#about' },
  { label: 'Contact', href: '/#contact' },
];

export const legalNav: NavLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Security', href: '/security' },
];

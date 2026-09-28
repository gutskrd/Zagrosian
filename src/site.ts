export interface Product {
  name: string;
  url: string;
  category: string;
  description: string;
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
  category: 'Kurdish language learning',
  description: 'Learn Kurdish with short lessons, multiplayer games and friends.',
};

export const site: SiteConfig = {
  name: 'Zagrosian',
  legalName: 'Zagrosian',
  url: 'https://zagrosian.com',
  country: 'the Netherlands',
  tagline: 'Software for Kurdish communities.',
  title: 'Zagrosian — Software for Kurdish communities',
  description:
    'Zagrosian is an independent technology company building software for Kurdish communities worldwide, including Hevalo, an app for learning Kurdish.',
  emails: {
    contact: 'contact@zagrosian.com',
    press: 'press@zagrosian.com',
  },
  products: [hevalo],
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

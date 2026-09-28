export interface Product {
  name: string;
  url: string;
  description: string;
}

export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface SiteConfig {
  name: string;
  url: string;
  tagline: string;
  title: string;
  description: string;
  /**
   * Official contact address. Leave `null` until one exists: the Contact
   * section and every contact link stay hidden while it is unset.
   */
  contactEmail: string | null;
  products: Product[];
}

export const hevalo: Product = {
  name: 'Hevalo',
  url: 'https://hevalo.app',
  description: 'A Kurdish community platform, built to bring language, culture and people together.',
};

export const site: SiteConfig = {
  name: 'Zagrosian',
  url: 'https://zagrosian.com',
  tagline: 'Technology for our people.',
  title: 'Zagrosian — Technology for our people',
  description:
    'Zagrosian is the independent technology company behind Hevalo, building modern products for Kurdish language, culture and community.',
  contactEmail: null,
  products: [hevalo],
};

const contactLinks: NavLink[] = site.contactEmail ? [{ label: 'Contact', href: '/#contact' }] : [];

export const primaryNav: NavLink[] = [
  { label: 'Hevalo', href: '/#hevalo' },
  { label: 'About', href: '/#about' },
  ...contactLinks,
];

export const footerNav: NavLink[] = [
  { label: 'Hevalo', href: hevalo.url, external: true },
  { label: 'About', href: '/#about' },
  ...contactLinks,
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

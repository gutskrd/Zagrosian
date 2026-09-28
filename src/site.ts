export interface Product {
  name: string;
  url: string;
  category: string;
  description: string;
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
  /** Official address for general, privacy and security enquiries. */
  contactEmail: string;
  products: Product[];
}

export const hevalo: Product = {
  name: 'Hevalo',
  url: 'https://hevalo.app',
  category: 'Community platform',
  description: 'A community platform for Kurdish people, wherever they live.',
};

export const site: SiteConfig = {
  name: 'Zagrosian',
  legalName: 'Zagrosian',
  url: 'https://zagrosian.com',
  country: 'the Netherlands',
  tagline: 'Software for Kurdish communities.',
  title: 'Zagrosian — Software for Kurdish communities',
  description:
    'Zagrosian is an independent technology company building software for Kurdish communities worldwide, including Hevalo, a community platform for Kurdish people.',
  contactEmail: 'contact@zagrosian.com',
  products: [hevalo],
};

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

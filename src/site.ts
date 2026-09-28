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

export interface ContactRoute {
  label: string;
  description: string;
  email: string;
  /** Schema.org ContactPoint type, used in the homepage structured data. */
  contactType: string;
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
  /** Official addresses. `contact` is the main one, used wherever a single address is shown. */
  emails: {
    contact: string;
    hello: string;
    privacy: string;
    legal: string;
    careers: string;
    press: string;
  };
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
  emails: {
    contact: 'contact@zagrosian.com',
    hello: 'hello@zagrosian.com',
    privacy: 'privacy@zagrosian.com',
    legal: 'legal@zagrosian.com',
    careers: 'careers@zagrosian.com',
    press: 'press@zagrosian.com',
  },
  products: [hevalo],
};

/** The contact directory on the homepage, in display order. */
export const contactRoutes: ContactRoute[] = [
  {
    label: 'Business and partnerships',
    description: 'Our main address for companies and organisations.',
    email: site.emails.contact,
    contactType: 'business inquiries',
  },
  {
    label: 'General questions',
    description: 'Anything else you would like to ask or tell us.',
    email: site.emails.hello,
    contactType: 'general inquiries',
  },
  {
    label: 'Press',
    description: 'Media, interviews and press enquiries.',
    email: site.emails.press,
    contactType: 'press',
  },
  {
    label: 'Careers',
    description: 'Jobs and working at Zagrosian.',
    email: site.emails.careers,
    contactType: 'careers',
  },
  {
    label: 'Privacy',
    description: 'Questions about your data, and data protection requests.',
    email: site.emails.privacy,
    contactType: 'privacy',
  },
  {
    label: 'Legal',
    description: 'Legal notices and matters.',
    email: site.emails.legal,
    contactType: 'legal',
  },
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

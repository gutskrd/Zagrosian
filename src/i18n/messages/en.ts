/**
 * English text for the site. Every other language file has the same shape (the
 * `Messages` type), so a missing translation is a type error. The page, its
 * Markdown version and llms.txt are all built from these files.
 *
 * Kurdish phrases that are part of the brand (the motto and the footer line)
 * stay in Kurmanji in every language; see src/site.ts.
 */
export const en = {
  meta: {
    title: 'Zagrosian — Technology for everyday life',
    tagline: 'Technology for everyday life.',
    description:
      'Zagrosian is an independent technology company based in the Netherlands. We design and build consumer products, starting with Hevalo, an app for learning Kurdish.',
  },
  common: {
    skipToContent: 'Skip to content',
    homeLink: 'Zagrosian, home',
    primaryNav: 'Primary',
    footerNav: 'Footer',
    socialNav: 'Social media',
    legalNav: 'Legal',
    menu: 'Menu',
    close: 'Close',
    backToTop: 'Back to top',
    loading: 'Loading',
  },
  nav: {
    home: 'Home',
    hevalo: 'Hevalo',
    about: 'About',
    contact: 'Contact',
    visitHevalo: 'Visit Hevalo',
    privacy: 'Privacy',
    terms: 'Terms',
    security: 'Security',
  },
  theme: {
    toggle: 'Dark theme',
    legend: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },
  sound: {
    /** The header button that switches sound on and off (its state is announced as pressed). */
    label: 'Sound',
    on: 'Turn sound on',
    off: 'Turn sound off',
    /** Offered once to first-time visitors, with the `on` and `dismiss` buttons. */
    prompt: 'Best experienced with sound.',
    dismiss: 'No thanks',
  },
  language: {
    label: 'Language',
    /** Offered to visitors whose browser prefers this language (written in this language). */
    suggestion: 'This page is also available in English.',
    switchTo: 'Read in English',
    dismiss: 'Dismiss',
  },
  hero: {
    notice: 'Hevalo is coming to iOS and Android',
    /** One entry per line of the headline. */
    headline: ['Technology for', 'everyday life.'],
    lead: 'Zagrosian is an independent technology company based in the Netherlands. We design and build consumer products, starting with Hevalo, an app for learning Kurdish.',
    products: 'Our products',
    about: 'About Zagrosian',
    logoAlt: 'The Zagrosian logo: two hands reaching towards each other',
  },
  hevalo: {
    eyebrow: 'Products',
    category: 'Kurdish language learning',
    description:
      'An app for learning Kurdish through short lessons and games played with friends. Available first in Kurmanji, with more dialects planned.',
    visit: 'Visit hevalo.app',
    website: 'Website',
    comingSoon: 'Coming soon',
    comingSoonTitle: 'Hevalo for iOS and Android.',
    comingSoonNote: 'The native apps are in development and will be available on the App Store and Google Play.',
  },
  /** Zagrosian's three values, from the mission below, shown one by one under the hero. */
  story: {
    values: ['Fast.', 'Private.', 'Well designed.'],
  },
  /** Translation of the Kurmanji motto "Jiyan bi kurdî xweştire." Empty in Kurmanji. */
  motto: 'Life is sweeter in Kurdish.',
  about: {
    eyebrow: 'About',
    mission: 'Our mission is to build software people enjoy using every day: fast, private and well designed.',
    approach: 'Zagrosian is privately owned. We design and build our products in-house.',
    headquartersLabel: 'Headquarters',
    headquarters: 'Netherlands',
    productsLabel: 'Products',
    /** Shown with the headquarters: the current time there. */
    localTime: '{time} local time',
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Get in touch.',
    lead: 'For general enquiries and partnerships, please contact us by email.',
    general: 'General enquiries:',
    copy: 'Copy address',
    copied: 'Copied',
    copiedStatus: '{email} copied to the clipboard.',
    copyFailed: 'Could not copy. Select {email} to copy it instead.',
    press: 'Press enquiries:',
    /** "To report a security issue, please see our [security policy]." */
    security: { before: 'To report a security issue, please see our', link: 'security policy', after: '.' },
  },
  footer: {
    about: ['Independent technology company', 'based in the Netherlands.'],
  },
  legal: {
    eyebrow: 'Legal',
    updated: 'Last updated',
    contents: 'On this page',
    /** Shown on translated legal pages only. */
    translationNotice: 'This is a translation. If it differs from the English version, the English version applies.',
    readEnglish: 'Read the English version',
    /** {duration} is a number of minutes, written with the unit style below. */
    readingTime: '{duration} read',
    readingTimeUnit: 'short' as 'short' | 'long',
    print: 'Print',
    copyLink: 'Copy link to this section',
    linkCopied: 'Link copied to the clipboard.',
  },
  /** The quick navigation menu (Ctrl K or ⌘K). */
  command: {
    open: 'Search',
    title: 'Quick navigation',
    placeholder: 'Search pages, sections and settings…',
    pages: 'Pages',
    sections: 'Sections',
    actions: 'Actions',
    copyEmail: 'Copy email address',
    empty: 'No results found.',
    hintMove: 'to move',
    hintOpen: 'to open',
    hintClose: 'to close',
  },
  notFound: {
    title: 'Page not found',
    heading: 'This page doesn’t exist.',
    description: 'The page you were looking for could not be found.',
    body: 'The link may be broken, or the page may have moved.',
    back: 'Back to homepage',
  },
};

export type Messages = typeof en;

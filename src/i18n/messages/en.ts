/**
 * English text for the site. Every other language file has the same shape (the
 * `Messages` type), so a missing translation is a type error. The page, its
 * Markdown version and llms.txt are all built from these files.
 *
 * Kurdish phrases that are part of the brand (the motto and the footer line)
 * stay in Kurmanji in every language; see src/site.ts.
 */
/** Text for a count, in each plural form a language uses (Intl.PluralRules): `other` always. */
export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

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
  },
  nav: {
    home: 'Home',
    hevalo: 'Hevalo',
    /** The page with Hevalo's book (/book). Never just "Book", which reads as a verb. */
    book: 'Hevalo’s book',
    about: 'About',
    faq: 'FAQ',
    contact: 'Contact',
    visitHevalo: 'Visit Hevalo',
    privacy: 'Privacy',
    terms: 'Terms',
    security: 'Security',
  },
  theme: {
    legend: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },
  sound: {
    /** The button in the site menu that switches sound on and off (announced as pressed or not). */
    label: 'Sound',
    on: 'Turn sound on',
    off: 'Turn sound off',
    /** Offered once to first-time visitors, with the `on` and `dismiss` buttons. */
    prompt: 'Best experienced with sound.',
    dismiss: 'No thanks',
  },
  share: {
    /** In the site menu: the system's share sheet, or the link copied where there is none. */
    button: 'Share this page',
    copied: 'Link copied',
    copiedStatus: 'Link copied to the clipboard.',
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
    /** The link from the products section to the book's page. */
    readBook: 'Read Hevalo’s book, free',
    website: 'Website',
    comingSoon: 'Coming soon',
    /** The facts under Hevalo's description: its dialects, and its native apps (shown with `comingSoon`). */
    dialectsLabel: 'Dialects',
    dialects: 'Kurmanji first, more planned',
    platformsLabel: 'iOS and Android',
    /** Translation of the Kurmanji proverb (`kurdish.proverb` in src/site.ts, shown by Proverb.astro). Empty in Kurmanji. */
    proverb: 'A tree thrives through its roots; a person through their language.',
    /** Shown after "Gotina pêşiyan" (Kurmanji for "proverb"). Empty in Kurmanji. */
    proverbSource: 'Kurdish proverb',
  },
  /** The rug in late sun (Underneath.astro). The title is for screen readers; the hint and button are seen. */
  under: {
    title: 'Lift a corner.',
    hintPointer: 'Lift the corner',
    hintTouch: 'Press and hold the corner',
    lift: 'Lift the rug',
    lay: 'Lay it back',
  },
  /** Zagrosian's three values, shown one by one in the story under the hero. */
  story: {
    values: ['Simplicity.', 'Privacy.', 'Clarity.'],
  },
  /** Translation of the Kurmanji motto "Jiyan bi kurdî xweştire." Empty in Kurmanji. */
  motto: 'Life is sweeter in Kurdish.',
  about: {
    eyebrow: 'About',
    mission: 'Our mission is to build software people enjoy using every day: simple, private and clear.',
    approach: 'Zagrosian is privately owned. We design and build our products in-house.',
    headquartersLabel: 'Headquarters',
    headquarters: 'Netherlands',
    productsLabel: 'Products',
    /** Shown with the headquarters: the current time there. */
    localTime: '{time} local time',
  },
  /**
   * Questions and answers, before Contact (Faq.astro), also in the Markdown
   * version and as FAQPage structured data. Answers may contain {hevalo},
   * {privacy}, {contact} and {security}, which become links:
   * {privacy} reads `privacyLink`, {security} reads `contact.security.link`.
   */
  faq: {
    eyebrow: 'FAQ',
    title: 'Common questions.',
    privacyLink: 'privacy policy',
    /** After the questions; {contact} becomes the email link. */
    more: 'Still have a question? Email us at {contact}.',
    items: [
      {
        question: 'What does Zagrosian do?',
        answer:
          'Zagrosian is an independent, privately owned technology company based in the Netherlands. We design and build consumer products in-house. Our first product is Hevalo, an app for learning Kurdish.',
      },
      {
        question: 'What is Hevalo?',
        answer:
          'Hevalo is an app for learning Kurdish through short lessons and games played with friends. You can find it at {hevalo}.',
      },
      {
        question: 'Which Kurdish dialects does Hevalo teach?',
        answer:
          'Hevalo starts with Kurmanji. More dialects are planned.',
      },
      {
        question: 'Is Hevalo available on iOS and Android?',
        answer:
          'Not yet. The native apps are in development and will be available on the App Store and Google Play.',
      },
      {
        question: 'Does zagrosian.com collect personal data?',
        answer:
          'Very little. The website has no accounts, forms, advertising, analytics or tracking. Your choice of theme, language and sound is saved only in your browser. Our {privacy} has the details.',
      },
      {
        question: 'How can I contact Zagrosian?',
        answer:
          'Email {contact} for general enquiries, partnerships and press enquiries. To report a security issue, please see our {security}.',
      },
    ],
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
    /** "To report a security issue, please see our [security policy]." */
    security: { before: 'To report a security issue, please see our', link: 'security policy', after: '.' },
  },
  footer: {
    about: ['Independent technology company', 'based in the Netherlands.'],
    /** Translation of the Kurmanji "Mala we ava." (thank you). Empty in Kurmanji. */
    thanks: 'Thank you. Literally: may your home prosper.',
    /** Before the trade register (KvK) and VAT numbers, once they are filled in (src/site.ts). */
    kvk: 'KvK',
    vat: 'VAT',
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
  /**
   * The page with Hevalo's book (BookPage.astro and the reader). The book is
   * in Kurmanji with English beside every line, and its title, Rêya Kurmancî,
   * stays in Kurmanji in every language (`kurdish.book` in src/site.ts).
   * Templates: {size} and {pages} are formatted for the language; {a}, {b},
   * {n} and {total} are page numbers; {where} is a counter and {chapter} a
   * chapter's or section's name.
   */
  book: {
    /** Within 70 characters, in every language. */
    metaTitle: 'Rêya Kurmancî: Hevalo’s free Kurmanji book — Zagrosian',
    /** Within 170 characters, in every language. */
    metaDescription:
      'Hevalo’s illustrated Kurmanji course book, with Hamo, Xezal and Hevalo and English beside every line. Read it here page by page, or download the free PDF.',
    /** The social image's description (public/og/book.jpg). */
    shareAlt: 'Rêya Kurmancî, Hevalo’s book, open at its first pages',
    eyebrow: 'Free book',
    /** Under the Kurmanji title: what it means, and whose book it is. In Kurmanji only "Pirtûka Hevalo". */
    subtitle: 'The Kurmanji Road · Hevalo’s book',
    lead: 'A course book in Kurmanji, with English beside every line. Learn with Hamo, Xezal and Hevalo, from the first hello to stories and songs: read it here, page by page, or download it to print and keep.',
    startReading: 'Start reading',
    download: 'Download the book',
    downloadShort: 'Download',
    /** Under the download: "PDF · 2.6 MB · 192 pages". */
    facts: 'PDF · {size} · {pages}',
    /** A number of pages, in each plural form the language has (Intl.PluralRules); `other` is required. */
    pageCount: { one: '{n} page', other: '{n} pages' } as Plural,
    edition: 'Edition of {date}',
    licence: 'Free to download, print and share for learning, but not for sale.',
    hearHamo: 'Hear Hamo say every line in Hevalo',
    inside: 'Inside the book',
    /** The reader's heading, for screen readers. */
    readerTitle: 'Read the book',
    /** The slider's name, for screen readers: what it moves through. */
    slider: 'Page',
    contents: 'Contents',
    previous: 'Previous page',
    next: 'Next page',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit to screen',
    /** The whole book as one column of pages, to scroll through. */
    scrollView: 'Scroll',
    /** The whole book as continuous text. */
    textView: 'Text',
    fullView: 'Full view',
    /** Shown while the book has keyboard focus. */
    keysHint: 'Arrow keys turn the pages; [ and ] go to the previous or next chapter; + and − zoom in and out.',
    /** Shown for a few seconds on touch screens, in place of the bar under the book, with `zoomHint` under it. */
    swipeHint: 'Tap the edges or swipe to turn',
    zoomHint: 'Double-tap to zoom',
    counterSpread: 'Pages {a} and {b} of {total}',
    counterPage: 'Page {a} of {total}',
    counterShort: '{a} / {total}',
    pageLabel: 'Page {n}',
    chapterLabel: 'Chapter {n}: {name}',
    /** Announced after a turn: "Pages 12 and 13 of 192. Chapter 1: Hello." */
    status: '{where}. {chapter}.',
    /** The parts of the book outside its chapters. */
    sections: {
      cover: 'Cover',
      letter: 'A letter from Hamo',
      contents: 'Contents',
      passport: 'The passport of the road',
      alphabet: 'The alphabet',
      people: 'The people of the road',
      answers: 'Answers',
      words: 'The word list',
      author: 'About the author',
      farewell: 'The last page',
    },
    /** The chapters' names, in order; in English they must be the book's own (src/lib/book.ts checks). */
    chapters: [
      'Hello',
      'Family',
      'House and village',
      'The market',
      'Days and time',
      'The city',
      'Weather and Newroz',
      'Body and health',
      'Yesterday',
      'The summer pastures',
      'Work and school',
      'Stories and songs',
    ],
    /** The card after the last page. */
    endTitle: 'That’s the whole book.',
    endLearn: 'Learn with Hevalo',
    backToStart: 'Back to the cover',
    /** Shown when a page's picture does not load: offline, or a new edition published under the reader. */
    loadFailed: 'Some pages could not be loaded.',
    reload: 'Reload',
    /** For apps' own browsers, which often cannot download files. */
    inAppHint: 'Download not starting? Open this page in your browser.',
    /** Printed instead of the reader; {url} is the PDF's address. */
    printNote: 'To print the book, download the PDF from {url}.',
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

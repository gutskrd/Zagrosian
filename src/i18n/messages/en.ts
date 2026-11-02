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
  },
  nav: {
    home: 'Home',
    hevalo: 'Hevalo',
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
    website: 'Website',
    comingSoon: 'Coming soon',
    /** The facts under Hevalo's description: its dialects, and its native apps (shown with `comingSoon`). */
    dialectsLabel: 'Dialects',
    dialects: 'Kurmanji first, more planned',
    platformsLabel: 'iOS and Android',
    /** Translation of the Kurmanji proverb shown with Hevalo (`kurdish.proverb` in src/site.ts). Empty in Kurmanji. */
    proverb: 'A tree thrives through its roots; a person through their language.',
    /** Shown after "Gotina pêşiyan" (Kurmanji for "proverb"). Empty in Kurmanji. */
    proverbSource: 'Kurdish proverb',
    /** The link from the Hevalo section to /hevalo-bot. */
    discord: 'Hevalo for Discord',
  },
  /**
   * The Hevalo Discord bot's page (/hevalo-bot). Slash commands such as /setup
   * stay in English in every language: they are what people type in Discord.
   */
  bot: {
    /** The page's name: its title (with " — Zagrosian"), breadcrumb and Markdown heading. */
    title: 'Hevalo for Discord',
    description:
      'Learn Kurdish in your Discord server with words, quizzes, games and an AI tutor, plus moderation, safety tools and music. Free, and Kurmanji first.',
    eyebrow: 'Hevalo for Discord',
    /** One entry per line of the heading. */
    headline: ['Learn Kurdish', 'where you already talk.'],
    lead: 'Hevalo brings Kurdish into your Discord server: a new word every morning, quizzes and games with friends, and an AI tutor that answers in Kurmanji. It also keeps your community safe and plays music.',
    add: 'Add to Discord server',
    addApp: 'Add to my apps',
    addAppNote: 'Puts Hevalo’s learning and AI commands in your own account, for direct messages and any server.',
    free: 'Free · Kurmanji first · Eight languages',
    featuresTitle: 'What Hevalo does',
    features: [
      {
        title: 'Learn every day',
        text: 'Words with pronunciation and examples, quizzes and a daily challenge, with XP, levels and streaks. A word of the day appears in your server every morning.',
      },
      {
        title: 'Play together',
        text: 'Peyvok, a Kurmanji word game with ç, ê, î, ş and û, and a leaderboard of your server’s best learners.',
      },
      {
        title: 'Ask and translate',
        text: 'An AI tutor that answers questions, explains grammar and lets you practise conversations. Right-click any message to translate it.',
      },
      {
        title: 'Keep it safe',
        text: 'Discord’s own AutoMod rules against spam, mass mentions, slurs and scam links, raid protection, warnings that escalate, and a log of every moderation action.',
      },
      {
        title: 'Run your server',
        text: 'Welcome messages, a role for new members, buttons for picking roles and well-formatted announcements, all set up from inside Discord.',
      },
      {
        title: 'Listen together',
        text: 'Music in voice channels, with buttons to pause, skip, repeat and shuffle. Only the people listening can control it.',
      },
    ],
    languagesTitle: 'Speaks your language',
    languages:
      'Hevalo speaks Kurmanji unless you ask for another language. Members choose their own with /ziman, and administrators choose the server’s.',
    startTitle: 'Get started in a minute',
    /** `command` is shown as code after the step; leave it empty for none. */
    steps: [
      { text: 'Add Hevalo to your server with the button above', command: '' },
      { text: 'Choose a channel for moderation logs', command: '/setup modlog' },
      { text: 'Turn on protection against spam and raids', command: '/automod setup' },
      { text: 'Welcome new members in a channel of your choice', command: '/setup welcome' },
    ],
    permissionsTitle: 'What Hevalo asks for, and why',
    permissionsLead:
      'Hevalo asks only for the permissions its features use, never Administrator. You can untick any of them when you add it; the features that need it then stop working.',
    /** One entry per group of permissions in the invite link (`hevaloBotPermissions` in src/site.ts). */
    permissions: [
      { name: 'View channels, send messages, embed links, add reactions', why: 'To answer commands and post the word of the day, welcomes and polls.' },
      { name: 'Read message history and manage messages', why: 'For /purge, which moderators use to clear spam.' },
      { name: 'Manage channels', why: 'For /lock and /slowmode.' },
      { name: 'Manage roles', why: 'For the role for new members, role buttons, and locking channels.' },
      { name: 'Time out, kick and ban members', why: 'For the moderation commands, which only your moderators can use.' },
      { name: 'Manage server', why: 'To set up AutoMod rules and pause invites during a raid.' },
      { name: 'Connect and speak', why: 'To play music in voice channels.' },
      { name: 'Mention everyone', why: 'For announcements that notify a role.' },
    ],
    noReading:
      'Hevalo does not read your server’s messages. It sees only the commands you use and the messages you choose to translate.',
    legalTitle: 'Terms and privacy',
    legalLead: 'By adding or using Hevalo, you agree to its terms. Its privacy policy explains what it stores, why and for how long.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    app: 'Hevalo is also an app for learning Kurdish with friends:',
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
   * {privacy}, {contact}, {press} and {security}, which become links:
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
          'Email {contact} for general enquiries and partnerships, or {press} for press enquiries. To report a security issue, please see our {security}.',
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
    press: 'Press enquiries:',
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
  notFound: {
    title: 'Page not found',
    heading: 'This page doesn’t exist.',
    description: 'The page you were looking for could not be found.',
    body: 'The link may be broken, or the page may have moved.',
    back: 'Back to homepage',
  },
};

export type Messages = typeof en;

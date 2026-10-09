import type { Messages } from './en';

/* French typography: a no-break space ( ) comes before ":" and the like. */
export const fr: Messages = {
  meta: {
    title: 'Zagrosian — La technologie au quotidien',
    tagline: 'La technologie au quotidien.',
    description:
      'Zagrosian est une entreprise technologique indépendante basée aux Pays-Bas. Nous créons des produits grand public, dont Hevalo, pour apprendre le kurde.',
  },
  common: {
    skipToContent: 'Aller au contenu',
    homeLink: 'Zagrosian, accueil',
    primaryNav: 'Navigation principale',
    footerNav: 'Pied de page',
    socialNav: 'Réseaux sociaux',
    legalNav: 'Informations légales',
    menu: 'Menu',
    close: 'Fermer',
    backToTop: 'Haut de page',
  },
  nav: {
    home: 'Accueil',
    hevalo: 'Hevalo',
    about: 'À propos',
    faq: 'FAQ',
    contact: 'Contact',
    visitHevalo: 'Découvrir Hevalo',
    privacy: 'Confidentialité',
    terms: 'Conditions',
    security: 'Sécurité',
  },
  theme: {
    toggle: 'Thème sombre',
    legend: 'Thème',
    system: 'Système',
    light: 'Clair',
    dark: 'Sombre',
  },
  sound: {
    label: 'Son',
    on: 'Activer le son',
    off: 'Couper le son',
    prompt: 'À découvrir avec le son.',
    dismiss: 'Non merci',
  },
  language: {
    label: 'Langue',
    suggestion: 'Cette page est aussi disponible en français.',
    switchTo: 'Lire en français',
    dismiss: 'Fermer',
  },
  hero: {
    notice: 'Hevalo arrive sur iOS et Android',
    headline: ['La technologie', 'au quotidien.'],
    lead: 'Zagrosian est une entreprise technologique indépendante basée aux Pays-Bas. Nous concevons et développons des produits grand public, à commencer par Hevalo, une application pour apprendre le kurde.',
    products: 'Nos produits',
    about: 'À propos de Zagrosian',
    logoAlt: 'Le logo de Zagrosian : deux mains tendues l’une vers l’autre',
  },
  hevalo: {
    eyebrow: 'Produits',
    category: 'Apprentissage du kurde',
    description:
      'Une application pour apprendre le kurde grâce à de courtes leçons et à des jeux à partager entre amis. D’abord disponible en kurmandji ; d’autres dialectes suivront.',
    visit: 'Visiter hevalo.app',
    website: 'Site web',
    comingSoon: 'Bientôt disponible',
    dialectsLabel: 'Dialectes',
    dialects: 'D’abord le kurmandji, d’autres prévus',
    platformsLabel: 'iOS et Android',
    proverb: 'L’arbre puise sa force dans ses racines, et chacun dans sa langue.',
    proverbSource: 'Proverbe kurde',
  },
  story: {
    values: ['Simplicité.', 'Confidentialité.', 'Clarté.'],
  },
  motto: 'La vie est plus douce en kurde.',
  about: {
    eyebrow: 'À propos',
    mission:
      'Notre mission est de créer des logiciels que l’on prend plaisir à utiliser chaque jour : simples, respectueux de la vie privée et clairs.',
    approach: 'Zagrosian est une entreprise privée. Nous concevons et développons nos produits en interne.',
    headquartersLabel: 'Siège',
    headquarters: 'Pays-Bas',
    productsLabel: 'Produits',
    localTime: '{time}, heure locale',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions fréquentes.',
    privacyLink: 'politique de confidentialité',
    more: 'Une autre question ? Écrivez-nous à {contact}.',
    items: [
      {
        question: 'Que fait Zagrosian ?',
        answer:
          'Zagrosian est une entreprise technologique indépendante et privée, basée aux Pays-Bas. Nous concevons et développons des produits grand public en interne. Notre premier produit est Hevalo, une application pour apprendre le kurde.',
      },
      {
        question: 'Qu’est-ce que Hevalo ?',
        answer:
          'Hevalo est une application pour apprendre le kurde grâce à de courtes leçons et à des jeux à partager entre amis. Vous la trouverez sur {hevalo}.',
      },
      {
        question: 'Quels dialectes kurdes Hevalo enseigne-t-il ?',
        answer:
          'Hevalo commence par le kurmandji. D’autres dialectes sont prévus.',
      },
      {
        question: 'Hevalo est-il disponible sur iOS et Android ?',
        answer:
          'Pas encore. Les applications natives sont en cours de développement et seront disponibles sur l’App Store et Google Play.',
      },
      {
        question: 'zagrosian.com collecte-t-il des données personnelles ?',
        answer:
          'Très peu. Le site ne comporte ni comptes, ni formulaires, ni publicité, ni outils de mesure d’audience, ni pistage. Votre choix de thème, de langue et de son n’est enregistré que dans votre navigateur. Pour en savoir plus, consultez notre {privacy}.',
      },
      {
        question: 'Comment contacter Zagrosian ?',
        answer:
          'Écrivez à {contact} pour toute demande générale ou proposition de partenariat, ou à {press} pour les demandes de la presse. Pour signaler un problème de sécurité, consultez notre {security}.',
      },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Contactez-nous.',
    lead: 'Pour toute demande générale ou proposition de partenariat, écrivez-nous par e-mail.',
    general: 'Demandes générales :',
    copy: 'Copier l’adresse',
    copied: 'Copiée',
    copiedStatus: 'L’adresse {email} a été copiée dans le presse-papiers.',
    copyFailed: 'Copie impossible. Sélectionnez {email} pour copier l’adresse.',
    press: 'Presse :',
    security: {
      before: 'Pour signaler un problème de sécurité, consultez notre',
      link: 'politique de sécurité',
      after: '.',
    },
  },
  footer: {
    about: ['Entreprise technologique indépendante', 'basée aux Pays-Bas.'],
    thanks: 'Merci. Littéralement : que votre maison prospère.',
    kvk: 'KvK',
    vat: 'TVA',
  },
  legal: {
    eyebrow: 'Informations légales',
    updated: 'Dernière mise à jour',
    contents: 'Sur cette page',
    translationNotice:
      'Ceci est une traduction. En cas de divergence avec la version anglaise, la version anglaise prévaut.',
    readEnglish: 'Lire la version anglaise',
    readingTime: '{duration} de lecture',
    readingTimeUnit: 'short',
    print: 'Imprimer',
    copyLink: 'Copier le lien vers cette section',
    linkCopied: 'Lien copié dans le presse-papiers.',
  },
  command: {
    open: 'Rechercher',
    title: 'Navigation rapide',
    placeholder: 'Rechercher des pages, des sections ou des réglages…',
    pages: 'Pages',
    sections: 'Sections',
    actions: 'Actions',
    copyEmail: 'Copier l’adresse e-mail',
    empty: 'Aucun résultat.',
    hintMove: 'pour naviguer',
    hintOpen: 'pour ouvrir',
    hintClose: 'pour fermer',
  },
  notFound: {
    title: 'Page introuvable',
    heading: 'Cette page n’existe pas.',
    description: 'La page que vous cherchez est introuvable.',
    body: 'Le lien est peut-être erroné, ou la page a été déplacée.',
    back: 'Retour à l’accueil',
  },
};

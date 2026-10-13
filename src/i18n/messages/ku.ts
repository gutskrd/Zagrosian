import type { Messages } from './en';

/* Kurmancî. Words shared with Hevalo's own interface (Biçe naverokê, Menû,
   Bigire, Di rê de, Hat kopîkirin, Rûpel nehat dîtin) are kept the same. */
export const ku: Messages = {
  meta: {
    title: 'Zagrosian — Teknolojî ji bo jiyana rojane',
    tagline: 'Teknolojî ji bo jiyana rojane.',
    description:
      'Zagrosian şirketeke teknolojiyê ya serbixwe ye li Holendayê. Em berheman ji bo bikarhêneran çêdikin; ya yekem Hevalo ye, sepaneke ji bo fêrbûna kurdî.',
  },
  common: {
    skipToContent: 'Biçe naverokê',
    homeLink: 'Zagrosian, rûpela sereke',
    primaryNav: 'Navîgasyona sereke',
    footerNav: 'Binê rûpelê',
    socialNav: 'Medyaya civakî',
    legalNav: 'Hiqûqî',
    menu: 'Menû',
    close: 'Bigire',
    backToTop: 'Vegere jor',
  },
  nav: {
    home: 'Rûpela sereke',
    hevalo: 'Hevalo',
    about: 'Derbarê me de',
    faq: 'Pirs û bersiv',
    contact: 'Têkilî',
    visitHevalo: 'Serdana Hevalo bike',
    privacy: 'Nepenî',
    terms: 'Şert û merc',
    security: 'Ewlekarî',
  },
  theme: {
    toggle: 'Tema tarî',
    legend: 'Tema',
    system: 'Pergal',
    light: 'Ronî',
    dark: 'Tarî',
  },
  sound: {
    label: 'Deng',
    on: 'Deng vêxe',
    off: 'Deng vemirîne',
    prompt: 'Bi deng xweştir e.',
    dismiss: 'Na, spas',
  },
  language: {
    label: 'Ziman',
    suggestion: 'Ev rûpel bi kurmancî jî heye.',
    switchTo: 'Bi kurmancî bixwîne',
    dismiss: 'Bigire',
  },
  hero: {
    notice: 'Hevalo tê ser iOS û Androidê',
    headline: ['Teknolojî ji bo', 'jiyana rojane.'],
    lead: 'Zagrosian şirketeke teknolojiyê ya serbixwe ye û navenda wê li Holendayê ye. Em ji bo bikarhêneran berheman disêwirînin û çêdikin; ya yekem Hevalo ye, sepaneke ji bo fêrbûna kurdî.',
    products: 'Berhemên me',
    about: 'Derbarê Zagrosian de',
    logoAlt: 'Logoya Zagrosian: du dest ku ber bi hev ve dirêj dibin',
  },
  hevalo: {
    eyebrow: 'Berhem',
    category: 'Fêrbûna kurdî',
    description:
      'Sepanek ji bo fêrbûna kurdî bi dersên kurt û lîstikên ku bi hevalan re tên lîstin. Pêşî bi kurmancî heye; zaravayên din jî di plana me de ne.',
    visit: 'Serdana hevalo.app bike',
    website: 'Malper',
    comingSoon: 'Di rê de',
    dialectsLabel: 'Zarava',
    dialects: 'Pêşî kurmancî, yên din di plana me de ne',
    platformsLabel: 'iOS û Android',
    proverb: '',
    proverbSource: '',
  },
  story: {
    values: ['Sadeyî.', 'Nepenî.', 'Zelalî.'],
  },
  // The motto is already in Kurmancî.
  motto: '',
  about: {
    eyebrow: 'Derbarê me de',
    mission:
      'Armanca me ew e ku em nermalavên wisa çêbikin ku mirov her roj bi kêfxweşî bi kar bînin: sade, nepeniyê diparêzin û zelal in.',
    approach: 'Zagrosian şirketeke taybet e. Em berhemên xwe bi xwe disêwirînin û çêdikin.',
    headquartersLabel: 'Navend',
    headquarters: 'Holenda',
    productsLabel: 'Berhem',
    localTime: 'Demjimêra herêmî: {time}',
  },
  faq: {
    eyebrow: 'Pirs û bersiv',
    title: 'Pirsên ku pir tên pirsîn.',
    privacyLink: 'polîtîkaya me ya nepeniyê',
    more: 'Pirseke we ya din heye? E-nameyê ji {contact} re bişînin.',
    items: [
      {
        question: 'Zagrosian çi dike?',
        answer:
          'Zagrosian şirketeke teknolojiyê ya serbixwe û taybet e, û navenda wê li Holendayê ye. Em berhemên ji bo bikarhêneran bi xwe disêwirînin û çêdikin. Berhema me ya yekem Hevalo ye, sepaneke ji bo fêrbûna kurdî.',
      },
      {
        question: 'Hevalo çi ye?',
        answer:
          'Hevalo sepaneke ji bo fêrbûna kurdî ye, bi dersên kurt û lîstikên ku bi hevalan re tên lîstin. Hûn dikarin wê li {hevalo} bibînin.',
      },
      {
        question: 'Hevalo kîjan zaravayên kurdî hîn dike?',
        answer:
          'Hevalo bi kurmancî dest pê dike. Zaravayên din jî di plana me de ne.',
      },
      {
        question: 'Gelo Hevalo li ser iOS û Androidê heye?',
        answer:
          'Hêj na. Sepanên xwecihî di pêşxistinê de ne û dê li App Store û Google Playê peyda bibin.',
      },
      {
        question: 'Gelo zagrosian.com daneyên kesane berhev dike?',
        answer:
          'Pir kêm. Li ser malperê hesab, form, reklam, analîtîk an şopandin tune ne. Bijartina we ya temayê, ziman û deng tenê di geroka we de tê tomarkirin. Ji bo hûrguliyan, li {privacy} binêrin.',
      },
      {
        question: 'Ez çawa dikarim bi Zagrosian re têkilî daynim?',
        answer:
          'Ji bo pirsên giştî û hevkariyan e-nameyê ji {contact} re bişînin, ji bo pirsên çapemeniyê jî ji {press} re. Ji bo ragihandina pirsgirêkeke ewlekariyê, ji kerema xwe li {security} binêrin.',
      },
    ],
  },
  contact: {
    eyebrow: 'Têkilî',
    title: 'Bi me re têkilî daynin.',
    lead: 'Ji bo pirsên giştî û hevkariyan, ji kerema xwe bi e-nameyê bi me re têkilî daynin.',
    general: 'Pirsên giştî:',
    copy: 'Navnîşanê kopî bike',
    copied: 'Hat kopîkirin',
    copiedStatus: '{email} hat kopîkirin.',
    copyFailed: 'Kopîkirin pêk nehat. Ji bo kopîkirinê {email} hilbijêrin.',
    press: 'Pirsên çapemeniyê:',
    security: {
      before: 'Ji bo ragihandina pirsgirêkeke ewlekariyê, ji kerema xwe li',
      link: 'polîtîkaya me ya ewlekariyê',
      after: ' binêrin.',
    },
  },
  footer: {
    about: ['Şirketeke teknolojiyê ya serbixwe', 'li Holendayê.'],
    thanks: '',
    kvk: 'KvK',
    vat: 'Hejmara bacê',
  },
  legal: {
    eyebrow: 'Hiqûqî',
    updated: 'Nûvekirina dawî',
    contents: 'Di vê rûpelê de',
    translationNotice: 'Ev wergerek e. Heke ji guhertoya îngilîzî cuda be, guhertoya îngilîzî derbasdar e.',
    readEnglish: 'Guhertoya îngilîzî bixwîne',
    readingTime: 'Dema xwendinê: {duration}',
    readingTimeUnit: 'long',
    print: 'Çap bike',
    copyLink: 'Girêdana vê beşê kopî bike',
    linkCopied: 'Girêdan hat kopîkirin.',
  },
  command: {
    open: 'Lêgerîn',
    title: 'Navîgasyona bilez',
    placeholder: 'Li rûpel, beş û mîhengan bigerin…',
    pages: 'Rûpel',
    sections: 'Beş',
    actions: 'Kiryar',
    copyEmail: 'Navnîşana e-nameyê kopî bike',
    empty: 'Encam nehat dîtin.',
    hintMove: 'ji bo gerê',
    hintOpen: 'ji bo vekirinê',
    hintClose: 'ji bo girtinê',
  },
  notFound: {
    title: 'Rûpel nehat dîtin',
    heading: 'Ev rûpel tune ye.',
    description: 'Rûpela ku hûn lê digeriyan nehat dîtin.',
    body: 'Dibe ku girêdan xelet be, an jî rûpel hatibe guhastin.',
    back: 'Vegere rûpela sereke',
  },
};

import type { Messages } from './en';

/* Brand and product names (Zagrosian, Hevalo, iOS) stay in Latin script. */
export const ar: Messages = {
  meta: {
    title: 'Zagrosian — تقنية للحياة اليومية',
    tagline: 'تقنية للحياة اليومية.',
    description:
      'Zagrosian شركة تقنية مستقلة مقرّها هولندا. نصمّم ونطوّر منتجات رقمية للأفراد، أولها Hevalo، تطبيق لتعلّم اللغة الكردية.',
  },
  common: {
    skipToContent: 'تخطَّ إلى المحتوى',
    homeLink: 'Zagrosian، الصفحة الرئيسية',
    primaryNav: 'التنقل الرئيسي',
    footerNav: 'تذييل الصفحة',
    socialNav: 'وسائل التواصل الاجتماعي',
    legalNav: 'معلومات قانونية',
    menu: 'القائمة',
    close: 'إغلاق',
    backToTop: 'العودة إلى الأعلى',
  },
  nav: {
    home: 'الرئيسية',
    hevalo: 'Hevalo',
    about: 'من نحن',
    faq: 'الأسئلة الشائعة',
    contact: 'تواصل معنا',
    visitHevalo: 'زيارة Hevalo',
    privacy: 'الخصوصية',
    terms: 'الشروط',
    security: 'الأمان',
  },
  theme: {
    toggle: 'المظهر الداكن',
    legend: 'المظهر',
    system: 'حسب النظام',
    light: 'فاتح',
    dark: 'داكن',
  },
  sound: {
    label: 'الصوت',
    on: 'تشغيل الصوت',
    off: 'إيقاف الصوت',
    prompt: 'التجربة أجمل مع الصوت.',
    dismiss: 'لا، شكرًا',
  },
  language: {
    label: 'اللغة',
    suggestion: 'هذه الصفحة متاحة أيضًا باللغة العربية.',
    switchTo: 'تصفّح بالعربية',
    dismiss: 'إغلاق',
  },
  hero: {
    notice: 'Hevalo قريبًا على iOS وأندرويد',
    headline: ['تقنية', 'للحياة اليومية.'],
    lead: 'Zagrosian شركة تقنية مستقلة مقرّها هولندا. نصمّم ونطوّر منتجات رقمية للأفراد، أولها Hevalo، تطبيق لتعلّم اللغة الكردية.',
    products: 'منتجاتنا',
    about: 'عن Zagrosian',
    logoAlt: 'شعار Zagrosian: يدان ممدودتان إحداهما نحو الأخرى',
  },
  hevalo: {
    eyebrow: 'المنتجات',
    category: 'تعلّم اللغة الكردية',
    description:
      'تطبيق لتعلّم اللغة الكردية من خلال دروس قصيرة وألعاب تلعبها مع الأصدقاء. متاح أولًا باللهجة الكرمانجية، مع خطط لإضافة لهجات أخرى.',
    visit: 'زيارة hevalo.app',
    website: 'الموقع الإلكتروني',
    comingSoon: 'قريبًا',
    dialectsLabel: 'اللهجات',
    dialects: 'الكرمانجية أولًا، مع خطط للهجات أخرى',
    platformsLabel: 'iOS وأندرويد',
    proverb: 'الشجرة على جذورها، والإنسان على لسانه يزدهر.',
    proverbSource: 'مثل كردي',
  },
  story: {
    values: ['البساطة.', 'الخصوصية.', 'الوضوح.'],
  },
  motto: 'الحياة أحلى بالكردية.',
  about: {
    eyebrow: 'من نحن',
    mission: 'مهمتنا بناء برمجيات يستمتع الناس باستخدامها كل يوم: بسيطة، وتحترم الخصوصية، وواضحة.',
    approach: 'Zagrosian شركة مملوكة ملكية خاصة. نصمّم منتجاتنا ونطوّرها بأنفسنا.',
    headquartersLabel: 'المقر الرئيسي',
    headquarters: 'هولندا',
    productsLabel: 'المنتجات',
    localTime: 'الساعة {time} بالتوقيت المحلي',
  },
  faq: {
    eyebrow: 'أسئلة وأجوبة',
    title: 'الأسئلة الشائعة.',
    privacyLink: 'سياسة الخصوصية',
    more: 'هل لديك سؤال آخر؟ راسلنا على {contact}.',
    items: [
      {
        question: 'ماذا تفعل Zagrosian؟',
        answer:
          'Zagrosian شركة تقنية مستقلة مملوكة ملكية خاصة، مقرّها هولندا. نصمّم منتجات رقمية للأفراد ونطوّرها بأنفسنا، وأولها Hevalo، تطبيق لتعلّم اللغة الكردية.',
      },
      {
        question: 'ما هو Hevalo؟',
        answer:
          'Hevalo تطبيق لتعلّم اللغة الكردية من خلال دروس قصيرة وألعاب تلعبها مع الأصدقاء. تجده على {hevalo}.',
      },
      {
        question: 'ما اللهجات الكردية التي يعلّمها Hevalo؟',
        answer:
          'يبدأ Hevalo باللهجة الكرمانجية، مع خطط لإضافة لهجات أخرى.',
      },
      {
        question: 'هل Hevalo متاح على iOS وAndroid؟',
        answer:
          'ليس بعد. التطبيقات الأصلية قيد التطوير، وستكون متاحة على App Store وGoogle Play.',
      },
      {
        question: 'هل يجمع zagrosian.com بيانات شخصية؟',
        answer:
          'القليل جدًا. لا يحتوي الموقع على حسابات أو نماذج أو إعلانات أو أدوات تحليل أو تتبّع. ويُحفظ اختيارك للمظهر واللغة والصوت في متصفحك فقط. تجد التفاصيل في {privacy}.',
      },
      {
        question: 'كيف يمكنني التواصل مع Zagrosian؟',
        answer:
          'راسلنا على {contact} للاستفسارات العامة والشراكات، أو على {press} لاستفسارات الصحافة. للإبلاغ عن مشكلة أمنية، يُرجى الاطلاع على {security}.',
      },
    ],
  },
  contact: {
    eyebrow: 'تواصل معنا',
    title: 'يسعدنا تواصلك.',
    lead: 'للاستفسارات العامة والشراكات، يُرجى التواصل معنا عبر البريد الإلكتروني.',
    general: 'الاستفسارات العامة:',
    copy: 'نسخ العنوان',
    copied: 'تم النسخ',
    copiedStatus: 'تم نسخ {email} إلى الحافظة.',
    copyFailed: 'تعذّر النسخ. حدّد {email} لنسخ العنوان.',
    press: 'استفسارات الصحافة:',
    security: {
      before: 'للإبلاغ عن مشكلة أمنية، يُرجى الاطلاع على',
      link: 'سياسة الأمان',
      after: '.',
    },
  },
  footer: {
    about: ['شركة تقنية مستقلة', 'مقرّها هولندا.'],
    thanks: 'شكراً. وحرفياً: ليكن بيتكم عامراً.',
  },
  legal: {
    eyebrow: 'معلومات قانونية',
    updated: 'آخر تحديث',
    contents: 'في هذه الصفحة',
    translationNotice: 'هذه ترجمة. في حال وجود أي اختلاف بينها وبين النسخة الإنجليزية، تُعتمد النسخة الإنجليزية.',
    readEnglish: 'اقرأ النسخة الإنجليزية',
    readingTime: 'مدة القراءة: {duration}',
    readingTimeUnit: 'long',
    print: 'طباعة',
    copyLink: 'نسخ رابط هذا القسم',
    linkCopied: 'تم نسخ الرابط إلى الحافظة.',
  },
  command: {
    open: 'بحث',
    title: 'التنقل السريع',
    placeholder: 'ابحث في الصفحات والأقسام والإعدادات…',
    pages: 'الصفحات',
    sections: 'الأقسام',
    actions: 'الإجراءات',
    copyEmail: 'نسخ عنوان البريد الإلكتروني',
    empty: 'لا توجد نتائج.',
    hintMove: 'للتنقل',
    hintOpen: 'للفتح',
    hintClose: 'للإغلاق',
  },
  notFound: {
    title: 'الصفحة غير موجودة',
    heading: 'هذه الصفحة غير موجودة.',
    description: 'تعذّر العثور على الصفحة التي تبحث عنها.',
    body: 'قد يكون الرابط غير صحيح، أو ربما نُقلت الصفحة.',
    back: 'العودة إلى الصفحة الرئيسية',
  },
};

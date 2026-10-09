import type { Messages } from './en';

/* فارسی. Written in formal Persian (شما), with Persian letters (ی، ک), zero-width
   non-joiners where Persian needs them (می‌کنیم، داده‌ها) and the ezafe hamza
   (صفحهٔ). Brand and product names stay in Latin script. */
export const fa: Messages = {
  meta: {
    title: 'Zagrosian — فناوری برای زندگی روزمره',
    tagline: 'فناوری برای زندگی روزمره.',
    description:
      'Zagrosian شرکت مستقل فناوری با دفتر مرکزی در هلند است. ما محصولات دیجیتال برای کاربران طراحی و توسعه می‌دهیم و نخستین آن‌ها Hevalo است: اپلیکیشنی برای یادگیری زبان کردی.',
  },
  common: {
    skipToContent: 'رفتن به محتوای اصلی',
    homeLink: 'Zagrosian، صفحهٔ اصلی',
    primaryNav: 'ناوبری اصلی',
    footerNav: 'پایین صفحه',
    socialNav: 'شبکه‌های اجتماعی',
    legalNav: 'اطلاعات حقوقی',
    menu: 'منو',
    close: 'بستن',
    backToTop: 'بازگشت به بالا',
  },
  nav: {
    home: 'صفحهٔ اصلی',
    hevalo: 'Hevalo',
    about: 'دربارهٔ ما',
    faq: 'پرسش‌های متداول',
    contact: 'تماس با ما',
    visitHevalo: 'بازدید از Hevalo',
    privacy: 'حریم خصوصی',
    terms: 'شرایط استفاده',
    security: 'امنیت',
  },
  theme: {
    toggle: 'حالت تیره',
    legend: 'ظاهر',
    system: 'سیستم',
    light: 'روشن',
    dark: 'تیره',
  },
  sound: {
    label: 'صدا',
    on: 'روشن کردن صدا',
    off: 'خاموش کردن صدا',
    prompt: 'با صدا دلنشین‌تر است.',
    dismiss: 'نه، ممنون',
  },
  language: {
    label: 'زبان',
    suggestion: 'این صفحه به زبان فارسی نیز در دسترس است.',
    switchTo: 'مشاهده به فارسی',
    dismiss: 'بستن',
  },
  hero: {
    notice: 'Hevalo به‌زودی برای iOS و اندروید',
    headline: ['فناوری برای', 'زندگی روزمره.'],
    lead: 'Zagrosian شرکت مستقل فناوری با دفتر مرکزی در هلند است. ما محصولات دیجیتال برای کاربران طراحی و توسعه می‌دهیم و نخستین آن‌ها Hevalo است: اپلیکیشنی برای یادگیری زبان کردی.',
    products: 'محصولات ما',
    about: 'دربارهٔ Zagrosian',
    logoAlt: 'لوگوی Zagrosian: دو دست که به سوی هم دراز شده‌اند',
  },
  hevalo: {
    eyebrow: 'محصولات',
    category: 'یادگیری زبان کردی',
    description:
      'اپلیکیشنی برای یادگیری زبان کردی با درس‌های کوتاه و بازی‌هایی که با دوستان انجام می‌شود. نخست به کرمانجی عرضه می‌شود و گویش‌های دیگر نیز در برنامه است.',
    visit: 'بازدید از hevalo.app',
    website: 'وب‌سایت',
    comingSoon: 'به‌زودی',
    dialectsLabel: 'گویش‌ها',
    dialects: 'نخست کرمانجی، گویش‌های دیگر در برنامه است',
    platformsLabel: 'iOS و اندروید',
    proverb: 'درخت با ریشه‌اش سبز می‌شود و انسان با زبانش.',
    proverbSource: 'ضرب‌المثل کردی',
  },
  story: {
    values: ['سادگی.', 'حریم خصوصی.', 'وضوح.'],
  },
  motto: 'زندگی به زبان کردی شیرین‌تر است.',
  about: {
    eyebrow: 'دربارهٔ ما',
    mission:
      'مأموریت ما ساختن نرم‌افزاری است که مردم هر روز با لذت از آن استفاده کنند: ساده، حافظ حریم خصوصی و روشن.',
    approach: 'Zagrosian شرکتی خصوصی است. ما محصولاتمان را خودمان طراحی و توسعه می‌دهیم.',
    headquartersLabel: 'دفتر مرکزی',
    headquarters: 'هلند',
    productsLabel: 'محصولات',
    localTime: 'ساعت {time} به وقت محلی',
  },
  faq: {
    eyebrow: 'پرسش و پاسخ',
    title: 'پرسش‌های متداول.',
    privacyLink: 'سیاست حریم خصوصی',
    more: 'پرسش دیگری دارید؟ به {contact} ایمیل بزنید.',
    items: [
      {
        question: 'Zagrosian چه کار می‌کند؟',
        answer:
          'Zagrosian شرکتی مستقل و خصوصی در زمینهٔ فناوری با دفتر مرکزی در هلند است. ما محصولات دیجیتال برای کاربران را خودمان طراحی و توسعه می‌دهیم. نخستین محصول ما Hevalo است، اپلیکیشنی برای یادگیری زبان کردی.',
      },
      {
        question: 'Hevalo چیست؟',
        answer:
          'Hevalo اپلیکیشنی برای یادگیری زبان کردی با درس‌های کوتاه و بازی‌هایی است که با دوستان انجام می‌شود. آن را در {hevalo} پیدا می‌کنید.',
      },
      {
        question: 'Hevalo کدام گویش‌های کردی را آموزش می‌دهد؟',
        answer:
          'Hevalo با کرمانجی آغاز می‌کند و گویش‌های دیگر نیز در برنامه است.',
      },
      {
        question: 'آیا Hevalo برای iOS و Android در دسترس است؟',
        answer:
          'هنوز نه. اپلیکیشن‌های بومی در حال توسعه‌اند و در App Store و Google Play عرضه خواهند شد.',
      },
      {
        question: 'آیا zagrosian.com داده‌های شخصی جمع‌آوری می‌کند؟',
        answer:
          'بسیار کم. وب‌سایت حساب کاربری، فرم، تبلیغات، ابزار تحلیل یا ردیابی ندارد. انتخاب شما برای ظاهر، زبان و صدا فقط در مرورگرتان ذخیره می‌شود. جزئیات را در {privacy} بخوانید.',
      },
      {
        question: 'چگونه با Zagrosian تماس بگیرم؟',
        answer:
          'برای پرسش‌های عمومی و همکاری به {contact} و برای درخواست‌های رسانه‌ای به {press} ایمیل بزنید. برای گزارش یک مشکل امنیتی، لطفاً {security} را ببینید.',
      },
    ],
  },
  contact: {
    eyebrow: 'تماس با ما',
    title: 'با ما در تماس باشید.',
    lead: 'برای پرسش‌های عمومی و همکاری، لطفاً از طریق ایمیل با ما تماس بگیرید.',
    general: 'پرسش‌های عمومی:',
    copy: 'کپی نشانی',
    copied: 'کپی شد',
    copiedStatus: '{email} در کلیپ‌بورد کپی شد.',
    copyFailed: 'کپی انجام نشد. برای کپی کردن، {email} را انتخاب کنید.',
    press: 'درخواست‌های رسانه‌ای:',
    security: {
      before: 'برای گزارش یک مشکل امنیتی، لطفاً',
      link: 'سیاست امنیتی ما',
      after: ' را ببینید.',
    },
  },
  footer: {
    about: ['شرکت مستقل فناوری', 'با دفتر مرکزی در هلند.'],
    thanks: 'سپاس. واژه‌به‌واژه: خانه‌تان آباد.',
    kvk: 'KvK',
    vat: 'شمارهٔ مالیاتی',
  },
  legal: {
    eyebrow: 'اطلاعات حقوقی',
    updated: 'آخرین به‌روزرسانی',
    contents: 'در این صفحه',
    translationNotice: 'این متن ترجمه است. در صورت هرگونه مغایرت با نسخهٔ انگلیسی، نسخهٔ انگلیسی ملاک است.',
    readEnglish: 'مشاهدهٔ نسخهٔ انگلیسی',
    readingTime: 'زمان مطالعه: {duration}',
    readingTimeUnit: 'long',
    print: 'چاپ',
    copyLink: 'کپی پیوند این بخش',
    linkCopied: 'پیوند در کلیپ‌بورد کپی شد.',
  },
  command: {
    open: 'جست‌وجو',
    title: 'ناوبری سریع',
    placeholder: 'جست‌وجو در صفحه‌ها، بخش‌ها و تنظیمات…',
    pages: 'صفحه‌ها',
    sections: 'بخش‌ها',
    actions: 'کارها',
    copyEmail: 'کپی نشانی ایمیل',
    empty: 'نتیجه‌ای یافت نشد.',
    hintMove: 'برای جابه‌جایی',
    hintOpen: 'برای باز کردن',
    hintClose: 'برای بستن',
  },
  notFound: {
    title: 'صفحه پیدا نشد',
    heading: 'این صفحه وجود ندارد.',
    description: 'صفحه‌ای که به دنبال آن بودید پیدا نشد.',
    body: 'ممکن است پیوند نادرست باشد یا صفحه جابه‌جا شده باشد.',
    back: 'بازگشت به صفحهٔ اصلی',
  },
};

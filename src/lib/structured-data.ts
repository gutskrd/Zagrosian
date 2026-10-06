/**
 * schema.org structured data (JSON-LD) for every page. Each page describes
 * itself as a WebPage, in its own language, that belongs to the WebSite, which
 * is published by the Organization. The nodes reference each other by @id, so
 * search engines and other machines can join them into one description of the
 * company. The Organization and WebSite are described in English on every page,
 * so they are identical wherever they appear.
 */
import { locales, messages, type Locale } from '../i18n';
import { hevalo, site, socialProfiles } from '../site';
import { answerText, faq } from './faq';

const english = messages('en');

const home = `${site.url}/`;

const ids = {
  website: `${home}#website`,
  organization: `${home}#organization`,
  hevalo: `${home}#hevalo`,
  hevaloApp: `${home}#hevalo-app`,
};

export interface PageData {
  /** Canonical URL of the page. */
  url: string;
  title: string;
  description: string;
  locale: Locale;
  /** The homepage in the page's language, as the first breadcrumb. */
  home: { name: string; url: string };
  /** The page's name in breadcrumbs; set for pages below the homepage. */
  breadcrumb?: string;
  /** Date of the last material change (YYYY-MM-DD). */
  dateModified?: string;
}

export function structuredData(page: PageData) {
  const isHome = page.url === page.home.url;
  const breadcrumbId = `${page.url}#breadcrumb`;

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': ids.website,
      url: home,
      name: site.name,
      description: english.meta.description,
      inLanguage: locales.map((locale) => locale.code),
      publisher: { '@id': ids.organization },
    },
    {
      '@type': 'Organization',
      '@id': ids.organization,
      name: site.name,
      url: home,
      logo: { '@type': 'ImageObject', url: `${site.url}/logo.png`, width: 512, height: 512 },
      image: `${site.url}/og.png`,
      description: english.meta.description,
      slogan: english.meta.tagline,
      email: site.emails.contact,
      address: { '@type': 'PostalAddress', addressCountry: site.country },
      areaServed: 'Worldwide',
      knowsLanguage: locales.map((locale) => locale.code),
      contactPoint: [
        { '@type': 'ContactPoint', contactType: 'general inquiries', email: site.emails.contact },
        { '@type': 'ContactPoint', contactType: 'press', email: site.emails.press },
      ],
      sameAs: socialProfiles.map((profile) => profile.url),
      brand: { '@id': ids.hevalo },
    },
    {
      '@type': 'Brand',
      '@id': ids.hevalo,
      name: hevalo.name,
      url: hevalo.url,
      logo: hevalo.logo,
      description: english.hevalo.description,
    },
    // Hevalo itself: the app. Where it runs is left out: its site is
    // hevalo.app, and the native apps for iOS and Android are coming.
    {
      '@type': 'SoftwareApplication',
      '@id': ids.hevaloApp,
      name: hevalo.name,
      url: hevalo.url,
      description: english.hevalo.description,
      applicationCategory: 'EducationalApplication',
      inLanguage: 'ku',
      brand: { '@id': ids.hevalo },
      publisher: { '@id': ids.organization },
      image: hevalo.logo,
    },
    {
      '@type': 'WebPage',
      '@id': `${page.url}#webpage`,
      url: page.url,
      name: page.title,
      description: page.description,
      inLanguage: page.locale,
      isPartOf: { '@id': ids.website },
      publisher: { '@id': ids.organization },
      ...(isHome && {
        about: { '@id': ids.organization },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: page.locale === 'en' ? `${site.url}/og.png` : `${site.url}/og/${page.locale}.png`,
          width: 1200,
          height: 630,
        },
      }),
      ...(page.dateModified && { dateModified: page.dateModified }),
      ...(page.breadcrumb && { breadcrumb: { '@id': breadcrumbId } }),
    },
  ];

  // The homepage's questions and answers (Faq.astro), in its language.
  if (isHome) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${page.url}#faq`,
      url: `${page.url}#faq`,
      inLanguage: page.locale,
      isPartOf: { '@id': `${page.url}#webpage` },
      mainEntity: faq(page.locale).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: answerText(item.answer) },
      })),
    });
  }

  if (page.breadcrumb) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': breadcrumbId,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: page.home.name, item: page.home.url },
        { '@type': 'ListItem', position: 2, name: page.breadcrumb, item: page.url },
      ],
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

/** JSON for a <script type="application/ld+json"> element; `<` is escaped so the data can never end the element. */
export const toJsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

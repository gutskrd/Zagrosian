/**
 * schema.org structured data (JSON-LD) for every page. Each page is a WebPage in its own language,
 * part of the WebSite, which is published by the Organization. Nodes reference each other by @id so
 * consumers can merge them into one graph. The Organization and WebSite nodes are always in
 * English, so they're identical on every page.
 */
import { locales, messages, type Locale } from '../i18n';
import { book as bookSite, hevalo, kurdish, site, socialProfiles } from '../site';
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
  /** Canonical URL. */
  url: string;
  title: string;
  description: string;
  locale: Locale;
  /** Homepage in the page's locale, as the first breadcrumb. */
  home: { name: string; url: string };
  /** Breadcrumb label; set for pages below the homepage. */
  breadcrumb?: string;
  /** Last material change (YYYY-MM-DD). */
  dateModified?: string;
  /** Extra nodes for the page's graph, e.g. the Book on /book. */
  nodes?: Record<string, unknown>[];
  /** @id of the page's main entity. */
  mainEntity?: string;
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
      legalName: site.legalName,
      url: home,
      logo: { '@type': 'ImageObject', url: `${site.url}/logo.png`, width: 512, height: 512 },
      image: `${site.url}/og.png`,
      description: english.meta.description,
      slogan: english.meta.tagline,
      email: site.emails.contact,
      // Country only: the registered address, KvK number and phone are shown to visitors but kept
      // out of search (see `registration` in src/site.ts).
      address: { '@type': 'PostalAddress', addressCountry: site.country },
      areaServed: 'Worldwide',
      knowsLanguage: locales.map((locale) => locale.code),
      contactPoint: [
        { '@type': 'ContactPoint', contactType: 'general inquiries', email: site.emails.contact },
        { '@type': 'ContactPoint', contactType: 'press', email: site.emails.contact },
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
    // Hevalo, the app. Platforms are omitted: it's on hevalo.app, with native iOS and Android apps
    // upcoming.
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
      ...(page.mainEntity && { mainEntity: { '@id': page.mainEntity } }),
    },
    ...(page.nodes ?? []),
  ];

  // Homepage FAQ (Faq.astro), in the page's locale.
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

/**
 * Hevalo's book (/book): a free Kurmanji/English e-book with its PDF and chapters, published by the
 * company. Always in English, like the Organization. `datePublished` is the first edition on the
 * site (`book.published` in src/site.ts); later editions set `dateModified`.
 */
export function bookNode(edition: {
  date: string;
  edition: string;
  pageCount: number;
  levels: string;
  cover: string;
  pdfBytes: number;
  chapters: { number: number; titleKu: string; titleEn: string; start: number; end: number }[];
}) {
  const id = `${site.url}${bookSite.path}#book`;
  return {
    '@type': 'Book',
    '@id': id,
    name: kurdish.book,
    alternateName: [english.nav.book, english.book.subtitle.split(' · ')[0]],
    url: `${site.url}${bookSite.path}`,
    bookFormat: 'https://schema.org/EBook',
    inLanguage: ['ku', 'en'],
    numberOfPages: edition.pageCount,
    isAccessibleForFree: true,
    educationalLevel: edition.levels,
    learningResourceType: 'Textbook',
    datePublished: bookSite.published,
    dateModified: edition.date,
    bookEdition: edition.date,
    identifier: edition.edition,
    image: new URL(edition.cover, site.url).href,
    publisher: { '@id': ids.organization },
    encoding: {
      '@type': 'MediaObject',
      contentUrl: `${site.url}${bookSite.pdf}`,
      encodingFormat: 'application/pdf',
      contentSize: `${(edition.pdfBytes / 1e6).toFixed(1)} MB`,
    },
    hasPart: edition.chapters.map((chapter) => ({
      '@type': 'Chapter',
      position: chapter.number,
      name: `${chapter.titleKu} (${chapter.titleEn})`,
      pageStart: chapter.start,
      pageEnd: chapter.end,
    })),
  };
}

/**
 * Serializes JSON for a `<script type="application/ld+json">` element, escaping `<` so the data
 * can't close the element.
 */
export const toJsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

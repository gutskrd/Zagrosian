/**
 * schema.org structured data (JSON-LD) for every page. Each page describes
 * itself as a WebPage that belongs to the WebSite, which is published by the
 * Organization. The nodes reference each other by @id, so search engines and
 * other machines can join them into one description of the company.
 */
import { hevalo, site, socialProfiles } from '../site';

const home = `${site.url}/`;

const ids = {
  website: `${home}#website`,
  organization: `${home}#organization`,
  hevalo: `${home}#hevalo`,
};

export interface PageData {
  /** Canonical URL of the page. */
  url: string;
  title: string;
  description: string;
  /** The page's name in breadcrumbs; set for pages below the homepage. */
  breadcrumb?: string;
  /** Date of the last material change (YYYY-MM-DD). */
  dateModified?: string;
}

export function structuredData(page: PageData) {
  const isHome = page.url === home;
  const breadcrumbId = `${page.url}#breadcrumb`;

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': ids.website,
      url: home,
      name: site.name,
      description: site.description,
      inLanguage: 'en',
      publisher: { '@id': ids.organization },
    },
    {
      '@type': 'Organization',
      '@id': ids.organization,
      name: site.name,
      url: home,
      logo: { '@type': 'ImageObject', url: `${site.url}/logo.png`, width: 512, height: 512 },
      image: `${site.url}/og.png`,
      description: site.description,
      slogan: site.tagline,
      email: site.emails.contact,
      address: { '@type': 'PostalAddress', addressCountry: 'NL' },
      areaServed: 'Worldwide',
      knowsLanguage: ['en', 'ku'],
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
      description: hevalo.description,
    },
    {
      '@type': 'WebPage',
      '@id': `${page.url}#webpage`,
      url: page.url,
      name: page.title,
      description: page.description,
      inLanguage: 'en',
      isPartOf: { '@id': ids.website },
      publisher: { '@id': ids.organization },
      ...(isHome && {
        about: { '@id': ids.organization },
        primaryImageOfPage: { '@type': 'ImageObject', url: `${site.url}/og.png`, width: 1200, height: 630 },
      }),
      ...(page.dateModified && { dateModified: page.dateModified }),
      ...(page.breadcrumb && { breadcrumb: { '@id': breadcrumbId } }),
    },
  ];

  if (page.breadcrumb) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': breadcrumbId,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: home },
        { '@type': 'ListItem', position: 2, name: page.breadcrumb, item: page.url },
      ],
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

/** JSON for a <script type="application/ld+json"> element; `<` is escaped so the data can never end the element. */
export const toJsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

/**
 * Plain-text versions of the site for machines: every page as Markdown in every
 * language (/index.md, /privacy.md, /de/index.md, /de/privacy.md, …) and the
 * /llms.txt summary. The homepage text comes from the same messages as the HTML
 * page (src/i18n/messages); the legal pages are served from their Markdown
 * source (src/content/legal).
 */
import { getCollection } from 'astro:content';
import {
  defaultLocale,
  legalSlugs,
  localizePath,
  locales,
  messages,
  navigation,
  type LegalSlug,
  type Locale,
} from '../i18n';
import { hevalo, kurdish, site, socialProfiles } from '../site';

export interface TextPage {
  locale: Locale;
  /** `index` for the homepage, otherwise the legal page. */
  slug: 'index' | LegalSlug;
  title: string;
  description: string;
  /** Canonical URL of the HTML page. */
  url: string;
  /** URL of the Markdown version. */
  markdownUrl: string;
  /** Date of the last material change, where the page records one. */
  updated?: string;
  markdown: string;
}

const absolute = (path: string) => new URL(path, site.url).href;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** /index.md, /privacy.md, /de/index.md, /de/privacy.md */
export function markdownPath(locale: Locale, slug: TextPage['slug']): string {
  if (slug !== 'index') return `${localizePath(locale, `/${slug}`)}.md`;
  return locale === defaultLocale ? '/index.md' : `/${locale}/index.md`;
}

function homeMarkdown(locale: Locale): string {
  const t = messages(locale);
  const nav = navigation(locale);
  const social = socialProfiles.map((profile) => `- ${profile.label}: [@${profile.handle}](${profile.url})`);
  const legal = nav.legal.map((link) => `- [${link.label}](${absolute(link.href)})`);
  const { security } = t.contact;

  return `# ${site.name}

> ${t.meta.tagline}

${t.hero.lead}

## ${t.story.values.join(' ')}

*${kurdish.motto}*${t.motto ? ` (${t.motto})` : ''}

## ${t.hevalo.eyebrow}

### ${hevalo.name}

${t.hevalo.category}. ${t.hevalo.description}

- ${t.hevalo.website}: [${hevalo.domain}](${hevalo.url})
- ${t.hevalo.comingSoon}: ${t.hevalo.comingSoonTitle} ${t.hevalo.comingSoonNote}

## ${t.about.eyebrow}

${t.about.mission}

${t.about.approach}

- ${t.about.headquartersLabel}: ${t.about.headquarters}
- ${t.about.productsLabel}: [${hevalo.name}](${hevalo.url})

## ${t.contact.eyebrow}

${t.contact.lead}

- ${t.contact.general} [${site.emails.contact}](mailto:${site.emails.contact})
- ${t.contact.press} [${site.emails.press}](mailto:${site.emails.press})
- ${security.before} [${security.link}](${absolute(localizePath(locale, '/security'))})${security.after}

## ${t.common.socialNav}

${social.join('\n')}

## ${t.common.legalNav}

${legal.join('\n')}
`;
}

/** Every page with a Markdown version, in every language. */
export async function textPages(): Promise<TextPage[]> {
  const legal = await getCollection('legal');

  return locales.flatMap(({ code: locale }) => {
    const t = messages(locale);
    const home: TextPage = {
      locale,
      slug: 'index',
      title: t.nav.home,
      description: t.meta.description,
      url: absolute(localizePath(locale, '/')),
      markdownUrl: absolute(markdownPath(locale, 'index')),
      markdown: homeMarkdown(locale),
    };

    const legalPages = legalSlugs.map((slug): TextPage => {
      const entry = legal.find((item) => item.id === `${locale}/${slug}`);
      if (!entry) throw new Error(`Missing translation: src/content/legal/${locale}/${slug}.md`);
      const { title, description, updated } = entry.data;
      // Site-relative links become absolute, so the text works on its own.
      const body = (entry.body ?? '').trim().replace(/\]\((\/[^)]*)\)/g, (_, path: string) => `](${absolute(path)})`);
      const notice = locale === defaultLocale ? '' : `> ${t.legal.translationNotice}\n\n`;

      return {
        locale,
        slug,
        title,
        description,
        url: absolute(localizePath(locale, `/${slug}`)),
        markdownUrl: absolute(markdownPath(locale, slug)),
        updated: isoDate(updated),
        markdown: `# ${title}\n\n${t.legal.updated}: ${isoDate(updated)}\n\n${notice}${body}\n`,
      };
    });

    return [home, ...legalPages];
  });
}

/** /llms.txt: a short, structured overview for language models (https://llmstxt.org), in English. */
export async function llmsTxt(): Promise<string> {
  const t = messages(defaultLocale);
  const english = (await textPages()).filter((page) => page.locale === defaultLocale);
  const pages = english.map((page) =>
    page.slug === 'index'
      ? `- [Homepage](${page.markdownUrl}): what ${site.name} does, its products, mission and contact details`
      : `- [${page.title}](${page.markdownUrl}): ${page.description}`,
  );
  const languages = locales.map(
    ({ code, name, englishName }) =>
      `- [${name}](${absolute(markdownPath(code, 'index'))}): ${englishName}, ${absolute(localizePath(code, '/'))}`,
  );
  const social = socialProfiles.map((profile) => `${profile.label} @${profile.handle}`).join(', ');

  return `# ${site.name}

> ${t.meta.description}

- Headquarters: ${t.about.headquarters}
- Products: ${hevalo.name} (${hevalo.url}): ${t.hevalo.category}. On the web at ${hevalo.domain}; iOS and Android apps coming soon.
- Contact: ${site.emails.contact} (general), ${site.emails.press} (press)
- Social media: ${social}
- Languages: ${locales.map((locale) => locale.englishName).join(', ')}

## Pages

Each page is also available as Markdown at the links below.

${pages.join('\n')}

## Languages

The whole site is available in ${locales.length} languages, with the same pages at each address. Links go to the Markdown version of each homepage.

${languages.join('\n')}

## Products

- [${hevalo.name}](${hevalo.url}): ${t.hevalo.description}

## Optional

- [Full text](${absolute('/llms-full.txt')}): all of the English pages above in one file
`;
}

/** /llms-full.txt: the Markdown of every English page, in one file. */
export async function llmsFullTxt(): Promise<string> {
  const english = (await textPages()).filter((page) => page.locale === defaultLocale);
  return english.map((page) => page.markdown.trim()).join('\n\n---\n\n') + '\n';
}

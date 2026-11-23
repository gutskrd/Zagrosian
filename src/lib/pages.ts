/**
 * Plain-text versions of the site for machines: every page as Markdown in every locale (/index.md,
 * /privacy.md, /de/index.md, ...) plus /llms.txt. Homepage text comes from the same messages as the
 * HTML (src/i18n/messages); legal pages are served from their Markdown source (src/content/legal).
 * The book (/book.md) contains its introduction and contents, plus the full page-by-page text in
 * English, from the same edition as the HTML (src/lib/book.ts); other locales introduce it and link
 * to the English text.
 */
import { getCollection } from 'astro:content';
import {
  defaultLocale,
  format,
  legalSlugs,
  localizePath,
  locales,
  messages,
  navigation,
  type LegalSlug,
  type Locale,
} from '../i18n';
import { book as bookSite, hevalo, kurdish, site, socialProfiles } from '../site';
import { book, chapterName, chapters, editionDate, pageCountText, pages as bookPages, pdfSize, sections, type TextBlock } from './book';
import { answerMarkdown, faq, faqMore } from './faq';

export interface TextPage {
  locale: Locale;
  /** `index` for the homepage, `book` for Hevalo's book, otherwise a legal page. */
  slug: 'index' | 'book' | LegalSlug;
  title: string;
  description: string;
  /** Canonical URL of the HTML page. */
  url: string;
  /** URL of the Markdown version. */
  markdownUrl: string;
  /** Last material change, where the page records one. */
  updated?: string;
  markdown: string;
  /** Shorter version for llms-full.txt, where the full page would be too long. */
  summary?: string;
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
  const questions = faq(locale).map((item) => `### ${item.question}\n\n${answerMarkdown(item.answer)}`);

  return `# ${site.name}

> ${t.meta.tagline}

${t.hero.lead}

## ${t.story.values.join(' ')}

*${kurdish.motto}*${t.motto ? ` (${t.motto})` : ''}

## ${t.hevalo.eyebrow}

### ${hevalo.name}

${t.hevalo.category}. ${t.hevalo.description}

> *${kurdish.proverb}*${t.hevalo.proverb ? ` (${t.hevalo.proverb})` : ''}
> — ${kurdish.proverbSource}${t.hevalo.proverbSource ? `, ${t.hevalo.proverbSource}` : ''}

- ${t.hevalo.dialectsLabel}: ${t.hevalo.dialects}
- ${t.hevalo.website}: [${hevalo.domain}](${hevalo.url})
- ${t.hevalo.platformsLabel}: ${t.hevalo.comingSoon}

[${t.hevalo.readBook}](${absolute(nav.book.href)})

## ${t.about.eyebrow}

${t.about.mission}

${t.about.approach}

- ${t.about.headquartersLabel}: ${t.about.headquarters}
- ${t.about.productsLabel}: [${hevalo.name}](${hevalo.url})

## ${t.faq.title.replace(/[.。]$/, '')}

${questions.join('\n\n')}

${answerMarkdown(faqMore(locale))}

## ${t.contact.eyebrow}

${t.contact.lead}

- ${t.contact.general} [${site.emails.contact}](mailto:${site.emails.contact})
- ${security.before} [${security.link}](${absolute(localizePath(locale, '/security'))})${security.after}

## ${t.common.socialNav}

${social.join('\n')}

## ${t.common.legalNav}

${legal.join('\n')}
`;
}

/**
 * One book page's text as Markdown: headings, speakers, and the Kurmanji and English lines
 * verbatim.
 */
function blocksMarkdown(blocks: TextBlock[]): string {
  const text = (block: TextBlock) => block.spans.map((span) => span.text).join('');
  const out: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const next = blocks[i + 1];
    // Skip numbered badges, as on the page (BookPageText.astro).
    if (block.kind === 'label' && /^[\d\s]+$/.test(text(block))) continue;
    if (block.kind === 'speaker' && next?.kind === 'text') {
      out.push(`**${text(block)}** ${text(next)}`);
      i += 1;
    } else if (block.kind === 'heading') out.push(`#### ${text(block)}`);
    else if (block.kind === 'label' || block.kind === 'speaker') out.push(`*${text(block)}*`);
    else out.push(text(block));
  }
  return out.join('\n\n');
}

/**
 * Book Markdown: introduction, contents and (in English) the full text. The summary omits the text.
 */
function bookMarkdown(locale: Locale): { markdown: string; summary: string } {
  const t = messages(locale);
  const page = (n: number) => absolute(`${localizePath(locale, '/book')}#page-${n}`);
  const facts = format(t.book.facts, { size: pdfSize(locale), pages: pageCountText(locale) });
  const matter = (key: 'passport' | 'alphabet' | 'people' | 'answers' | 'words' | 'author') => {
    const section = sections.find((item) => item.key === key)!;
    return `- [${t.book.sections[key]}](${page(section.start)})`;
  };
  const chapterLines = chapters.map((chapter) => {
    const name = chapterName(locale, chapter);
    const title = name === chapter.titleKu ? `**${chapter.titleKu}**` : `**${chapter.titleKu}** (${name})`;
    return `${chapter.number}. [${title}](${page(chapter.start)}), ${chapter.cefr}: ${chapter.parts.map((part) => part.titleKu).join(' · ')}`;
  });
  const intro = `# ${kurdish.book}

> ${t.book.subtitle}

${t.book.lead}

- [${t.book.download}](${absolute(bookSite.pdf)}): ${facts}
- ${format(t.book.edition, { date: editionDate(locale) })}
- ${t.book.licence}
- [${t.book.hearHamo}](${hevalo.url})

## ${t.book.inside}

${[matter('passport'), matter('alphabet'), matter('people')].join('\n')}

${chapterLines.join('\n')}

${[matter('answers'), matter('words'), matter('author')].join('\n')}
`;
  if (locale !== defaultLocale) {
    return { markdown: `${intro}\n[${t.book.textView} (English, Kurmancî)](${absolute('/book.md')})\n`, summary: intro };
  }
  const text = bookPages.map((item) => `### ${format(t.book.pageLabel, { n: String(item.n) })}\n\n${blocksMarkdown(item.blocks)}`);
  return { markdown: `${intro}\n## ${t.book.readerTitle}\n\n${text.join('\n\n')}\n`, summary: intro };
}

/** Every page with a Markdown version, in every locale. */
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
      updated: site.updated,
      markdown: homeMarkdown(locale),
    };

    const legalPages = legalSlugs.map((slug): TextPage => {
      const entry = legal.find((item) => item.id === `${locale}/${slug}`);
      if (!entry) throw new Error(`Missing translation: src/content/legal/${locale}/${slug}.md`);
      const { title, description, updated } = entry.data;
      // Make site-relative links absolute so the text stands alone.
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

    const bookText = bookMarkdown(locale);
    const bookPage: TextPage = {
      locale,
      slug: 'book',
      title: t.book.metaTitle,
      description: t.book.metaDescription,
      url: absolute(localizePath(locale, bookSite.path)),
      markdownUrl: absolute(markdownPath(locale, 'book')),
      updated: book.date,
      markdown: bookText.markdown,
      summary: bookText.summary,
    };

    return [home, bookPage, ...legalPages];
  });
}

/** /llms.txt: a short structured overview for language models (https://llmstxt.org), in English. */
export async function llmsTxt(): Promise<string> {
  const t = messages(defaultLocale);
  const english = (await textPages()).filter((page) => page.locale === defaultLocale);
  const pages = english.map((page) =>
    page.slug === 'index'
      ? `- [Homepage](${page.markdownUrl}): what ${site.name} does, its products, mission, common questions and contact details`
      : page.slug === 'book'
        ? `- [${t.nav.book}: ${kurdish.book}](${page.markdownUrl}): ${page.description} The Markdown has the whole text, page by page.`
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
- Products: ${hevalo.name} (${hevalo.url}): ${t.hevalo.category}. Website: ${hevalo.domain}; iOS and Android apps coming soon.
- Contact: ${site.emails.contact} (general and press)
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
- [${kurdish.book}, ${t.nav.book} (PDF, ${pdfSize(defaultLocale)}, ${pageCountText(defaultLocale)})](${absolute(bookSite.pdf)}): ${t.book.metaDescription}

## Optional

- [Full text](${absolute('/llms-full.txt')}): all of the English pages above in one file
`;
}

/** /llms-full.txt: the Markdown of every English page in one file. */
export async function llmsFullTxt(): Promise<string> {
  const english = (await textPages()).filter((page) => page.locale === defaultLocale);
  return english.map((page) => (page.summary ?? page.markdown).trim()).join('\n\n---\n\n') + '\n';
}

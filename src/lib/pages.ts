/**
 * Plain-text versions of the site for machines: each page as Markdown
 * (/index.md, /privacy.md, …) and the /llms.txt summary. The homepage text comes
 * from the same copy as the HTML page (src/site.ts); the legal pages are served
 * from their Markdown source.
 */
import type { MarkdownInstance } from 'astro';
import { headquarters, hevalo, home, legalNav, site, socialProfiles } from '../site';

interface LegalFrontmatter {
  title: string;
  description: string;
  updated: string | Date;
}

export interface TextPage {
  /** File name without extension: `index`, `privacy`, … */
  slug: string;
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

const legalModules = import.meta.glob<MarkdownInstance<LegalFrontmatter>>('../pages/*.md', { eager: true });

const absolute = (path: string) => new URL(path, site.url).href;
const isoDate = (date: string | Date) => new Date(date).toISOString().slice(0, 10);

function homeMarkdown(): string {
  const { availability } = hevalo;
  const social = socialProfiles.map((profile) => `- ${profile.label}: [@${profile.handle}](${profile.url})`);
  const legal = legalNav.map((link) => `- [${link.label}](${absolute(link.href)})`);

  return `# ${site.name}

> ${site.tagline}

${home.lead}

## Products

### ${hevalo.name}

${hevalo.category}. ${hevalo.description}

- Website: [${availability.web}](${hevalo.url})
- Coming soon: ${availability.comingSoon.join(' and ')}. ${availability.comingSoonNote}

## About

${home.mission}

${home.approach}

- Headquarters: ${headquarters}
- Products: [${hevalo.name}](${hevalo.url})

*${home.motto.ku}* (Kurdish: "${home.motto.en}")

## Contact

${home.contact}

- General enquiries: [${site.emails.contact}](mailto:${site.emails.contact})
- Press: [${site.emails.press}](mailto:${site.emails.press})
- Security issues: see the [security policy](${absolute('/security')})

## Social media

${social.join('\n')}

## Legal

${legal.join('\n')}
`;
}

function legalMarkdown(page: MarkdownInstance<LegalFrontmatter>): string {
  // Site-relative links become absolute, so the text works on its own.
  const body = page.rawContent().trim().replace(/\]\((\/[^)]*)\)/g, (_, path: string) => `](${absolute(path)})`);
  return `# ${page.frontmatter.title}

Last updated: ${isoDate(page.frontmatter.updated)}

${body}
`;
}

/** Every page with a Markdown version: the homepage first, then the legal pages. */
export const textPages: TextPage[] = [
  {
    slug: 'index',
    title: 'Homepage',
    description: `What ${site.name} does, its products, mission and contact details.`,
    url: absolute('/'),
    markdownUrl: absolute('/index.md'),
    markdown: homeMarkdown(),
  },
  ...Object.entries(legalModules).map(([file, page]) => {
    const slug = file.replace(/^.*\/(.+)\.md$/, '$1');
    return {
      slug,
      title: page.frontmatter.title,
      description: page.frontmatter.description,
      url: absolute(`/${slug}`),
      markdownUrl: absolute(`/${slug}.md`),
      updated: isoDate(page.frontmatter.updated),
      markdown: legalMarkdown(page),
    };
  }),
];

/** /llms.txt: a short, structured overview for language models (https://llmstxt.org). */
export function llmsTxt(): string {
  const pages = textPages.map((page) => `- [${page.title}](${page.markdownUrl}): ${page.description}`);
  const social = socialProfiles.map((profile) => `${profile.label} @${profile.handle}`).join(', ');

  return `# ${site.name}

> ${site.description}

- Headquarters: ${headquarters}
- Products: ${hevalo.name} (${hevalo.url}): ${hevalo.category}. ${availabilitySummary()}
- Contact: ${site.emails.contact} (general), ${site.emails.press} (press)
- Social media: ${social}

## Pages

Each page is also available as Markdown at the links below.

${pages.join('\n')}

## Products

- [${hevalo.name}](${hevalo.url}): ${hevalo.description}

## Optional

- [Full text](${absolute('/llms-full.txt')}): all of the pages above in one file
`;
}

/** /llms-full.txt: the Markdown of every page, in one file. */
export function llmsFullTxt(): string {
  return textPages.map((page) => page.markdown.trim()).join('\n\n---\n\n') + '\n';
}

function availabilitySummary(): string {
  const { availability } = hevalo;
  return `On the web at ${availability.web}; ${availability.comingSoon.join(' and ')} apps coming soon.`;
}

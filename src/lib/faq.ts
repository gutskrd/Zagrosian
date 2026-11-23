/**
 * FAQ entries (Faq.astro) for a locale, with links resolved. The same list feeds the page, its
 * Markdown version and the FAQPage structured data, so all three stay in sync.
 *
 * Answers (and `faq.more`) may contain the placeholders {hevalo}, {privacy}, {contact} and
 * {security}, which become links.
 */
import { localizePath, messages, type Locale } from '../i18n';
import { hevalo, site } from '../site';

export interface FaqLink {
  text: string;
  href: string;
  /** LTR Latin text (an address) on every page. */
  ltr?: boolean;
}

export type FaqPart = string | FaqLink;

export interface FaqItem {
  question: string;
  answer: FaqPart[];
}

/** Replaces placeholders in a message with links. */
function linker(locale: Locale) {
  const t = messages(locale);
  const links: Record<string, FaqLink> = {
    hevalo: { text: hevalo.domain, href: hevalo.url, ltr: true },
    privacy: { text: t.faq.privacyLink, href: localizePath(locale, '/privacy') },
    security: { text: t.contact.security.link, href: localizePath(locale, '/security') },
    contact: { text: site.emails.contact, href: `mailto:${site.emails.contact}`, ltr: true },
  };

  return (text: string): FaqPart[] =>
    text
      .split(/(\{\w+\})/)
      .filter(Boolean)
      .map((part) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        if (!name) return part;
        const link = links[name];
        if (!link) throw new Error(`Unknown link {${name}} in the ${locale} FAQ`);
        return link;
      });
}

export function faq(locale: Locale): FaqItem[] {
  const link = linker(locale);
  return messages(locale).faq.items.map(({ question, answer }) => ({ question, answer: link(answer) }));
}

/** Closing line after the questions, pointing to where to ask more. */
export const faqMore = (locale: Locale) => linker(locale)(messages(locale).faq.more);

/** Answer as plain text, for structured data. */
export const answerText = (answer: FaqPart[]) => answer.map((part) => (typeof part === 'string' ? part : part.text)).join('');

/** Answer as Markdown with absolute links. */
export const answerMarkdown = (answer: FaqPart[]) =>
  answer.map((part) => (typeof part === 'string' ? part : `[${part.text}](${new URL(part.href, site.url).href})`)).join('');

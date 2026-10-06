/**
 * The questions and answers (Faq.astro), in a language, with the links in the
 * answers resolved. The same list feeds the page, its Markdown version and the
 * FAQPage structured data, so the three always say the same thing.
 *
 * Answers (and the closing line, `faq.more`) in the message files may contain
 * {hevalo}, {privacy}, {contact}, {press} and {security}; each becomes a link.
 */
import { localizePath, messages, type Locale } from '../i18n';
import { hevalo, site } from '../site';

export interface FaqLink {
  text: string;
  href: string;
  /** Latin text (an address) that reads left to right on every page. */
  ltr?: boolean;
}

export type FaqPart = string | FaqLink;

export interface FaqItem {
  question: string;
  answer: FaqPart[];
}

/** Turns the placeholders in a message into links. */
function linker(locale: Locale) {
  const t = messages(locale);
  const links: Record<string, FaqLink> = {
    hevalo: { text: hevalo.domain, href: hevalo.url, ltr: true },
    privacy: { text: t.faq.privacyLink, href: localizePath(locale, '/privacy') },
    security: { text: t.contact.security.link, href: localizePath(locale, '/security') },
    contact: { text: site.emails.contact, href: `mailto:${site.emails.contact}`, ltr: true },
    press: { text: site.emails.press, href: `mailto:${site.emails.press}`, ltr: true },
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

/** The line after the questions, which says where to ask another. */
export const faqMore = (locale: Locale) => linker(locale)(messages(locale).faq.more);

/** An answer as plain text, for structured data. */
export const answerText = (answer: FaqPart[]) => answer.map((part) => (typeof part === 'string' ? part : part.text)).join('');

/** An answer as Markdown, with absolute links. */
export const answerMarkdown = (answer: FaqPart[]) =>
  answer
    .map((part) => (typeof part === 'string' ? part : `[${part.text}](${new URL(part.href, site.url).href})`))
    .join('');

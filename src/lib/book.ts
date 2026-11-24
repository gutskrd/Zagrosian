/**
 * Hevalo's book as rendered on the site: the edition in src/assets/book/ (imported from Hevalo's
 * export by scripts/book.mjs), read once at build time.
 *
 * Each page has two renditions, 720 and 1440 px wide, imported as assets so they get content-hashed
 * names under /_astro/ (immutable caching, served without the Worker). The page text (text.json) is
 * imported raw and parsed here, so the large JSON doesn't slow down type checking.
 *
 * Any inconsistency fails the build rather than shipping a broken reader: images vs. the manifest,
 * the PDF vs. its recorded size, chapter names in every locale (English from the book itself), and
 * every plural form needed for "192 pages".
 */
import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { ImageMetadata } from 'astro';
import { formatDate, localeInfo, locales, messages, type Locale } from '../i18n';
import manifest from '../assets/book/book.json';
import textJson from '../assets/book/text.json?raw';
import { book as bookSite } from '../site';

export type SectionKey = 'cover' | 'letter' | 'contents' | 'passport' | 'alphabet' | 'people' | 'answers' | 'words' | 'author' | 'farewell';

export interface TextSpan {
  lang: 'ku' | 'en';
  text: string;
}

export interface TextBlock {
  kind: 'heading' | 'speaker' | 'label' | 'text';
  spans: TextSpan[];
}

export interface BookChapter {
  number: number;
  cefr: string;
  titleKu: string;
  titleEn: string;
  start: number;
  end: number;
  parts: { titleKu: string; start: number }[];
}

export interface BookSection {
  key: SectionKey;
  start: number;
  end: number;
}

export interface BookPage {
  n: number;
  /** Page 1 is on the right; after that, even pages are on the left and odd pages on the right. */
  side: 'left' | 'right';
  /** Chapter containing the page, if any. */
  chapter: BookChapter | null;
  /** Front or back matter section containing the page, if it isn't in a chapter. */
  section: BookSection | null;
  /** Chapter this page opens, if any. */
  opens: BookChapter | null;
  images: Record<720 | 1440, ImageMetadata>;
  blocks: TextBlock[];
}

/** Widths each page is rendered at. */
export const renditions = [720, 1440] as const;

/** The edition: date, pages, sections and chapters. */
export const book = manifest as typeof manifest & { sections: BookSection[]; chapters: BookChapter[] };
export const chapters: BookChapter[] = book.chapters;
export const sections: BookSection[] = book.sections;

/** Page image filename, e.g. p001-720.webp. */
const fileName = (n: number, width: number) => `p${String(n).padStart(3, '0')}-${width}.webp`;

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/book/pages/*.webp', { eager: true });
const images = new Map(Object.entries(files).map(([path, module]) => [path.split('/').pop()!, module.default]));
const text = JSON.parse(textJson) as { pages: { n: number; blocks: TextBlock[] }[] };

const fail = (message: string): never => {
  throw new Error(`Hevalo's book (src/assets/book): ${message}`);
};

// --- Build-time checks ---

if (images.size !== book.pageCount * renditions.length)
  fail(`${images.size} page pictures, expected ${book.pageCount * renditions.length}`);
if (text.pages.length !== book.pageCount) fail(`text.json has ${text.pages.length} pages, book.json ${book.pageCount}`);
const ratio = book.pagePt.h / book.pagePt.w;
for (let n = 1; n <= book.pageCount; n++) {
  for (const width of renditions) {
    const image = images.get(fileName(n, width)) ?? fail(`no picture ${fileName(n, width)}`);
    if (image.width !== width || Math.abs(image.height - width * ratio) > 1)
      fail(`${fileName(n, width)} is ${image.width}×${image.height}`);
  }
}
const pdfBytes = statSync(join(process.cwd(), 'public', bookSite.pdf)).size;
if (pdfBytes !== book.pdf.bytes) fail(`public${bookSite.pdf} is ${pdfBytes} bytes, book.json says ${book.pdf.bytes}`);
for (const { code, intl } of locales) {
  const t = messages(code).book;
  for (const chapter of chapters) {
    const name = t.chapters[chapter.number - 1];
    if (!name) fail(`chapter ${chapter.number} has no name in src/i18n/messages/${code}.ts (book.chapters)`);
    if (code === 'en' && name !== chapter.titleEn)
      fail(`chapter ${chapter.number} is “${chapter.titleEn}”, but book.chapters in en.ts says “${name}”`);
  }
  for (const category of new Intl.PluralRules(intl).resolvedOptions().pluralCategories) {
    if (!(category in t.pageCount)) fail(`book.pageCount in ${code}.ts has no “${category}” form`);
  }
}

// --- Pages ---

const within = <T extends { start: number; end: number }>(list: T[], n: number) =>
  list.find((item) => item.start <= n && n <= item.end) ?? null;

export const pages: BookPage[] = text.pages.map(({ n, blocks }) => {
  const chapter = within(chapters, n);
  return {
    n,
    side: n === 1 || n % 2 === 1 ? 'right' : 'left',
    chapter,
    section: chapter ? null : within(sections, n),
    opens: chapters.find((c) => c.start === n) ?? null,
    images: { 720: images.get(fileName(n, 720))!, 1440: images.get(fileName(n, 1440))! },
    blocks,
  };
});

/**
 * `sizes` for page images: two pages side by side on wide screens (half the width, or whatever the
 * height allows below the header and toolbars), one page on phones (width minus margins). An
 * estimate, since the reader's stage sets the real size, but enough to choose between 720 and 1440.
 */
export const pageSizes =
  '(min-aspect-ratio: 5/4) and (min-width: 600px) min(calc(50vw - 2rem), calc(70.5vh - 8.25rem)), min(calc(100vw - 2rem), calc(70.5vh - 9.75rem))';

// --- Localized strings ---

/** Formats a number with the locale's digits. */
export const formatNumber = (locale: Locale, value: number) => new Intl.NumberFormat(localeInfo(locale).intl).format(value);

/** "192 pages", with the locale's plural rules. */
export function pageCountText(locale: Locale, count = book.pageCount): string {
  const forms = messages(locale).book.pageCount;
  const form = forms[new Intl.PluralRules(localeInfo(locale).intl).select(count)] ?? forms.other;
  return form.replace('{n}', formatNumber(locale, count));
}

/** PDF size in MB, localized: "2.6 MB", "2,6 Mo". */
export const pdfSize = (locale: Locale) =>
  new Intl.NumberFormat(localeInfo(locale).intl, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(
    book.pdf.bytes / 1e6,
  );

/** Edition date, localized. */
export const editionDate = (locale: Locale) => formatDate(locale, book.date);

/** A chapter's name in the given locale. */
export const chapterName = (locale: Locale, chapter: BookChapter) => messages(locale).book.chapters[chapter.number - 1] ?? chapter.titleEn;

/** CEFR range the book covers, e.g. "A1-B1". */
export const levels = (() => {
  const all = [...new Set(chapters.map((chapter) => chapter.cefr))];
  return all.length > 1 ? `${all[0]}–${all.at(-1)}` : (all[0] ?? '');
})();

/**
 * Hevalo's book as the site shows it: the edition in src/assets/book/ (which
 * scripts/book.mjs brings in from Hevalo's own export), read once at build.
 *
 * Every page is two pictures, 720 and 1440 pixels wide, imported as assets,
 * so the build gives them fingerprinted names under /_astro/: cached for a
 * year and served without the Worker. Its words (text.json) are read as raw
 * text and parsed here, so a large JSON file does not slow type checking.
 *
 * Anything that does not add up stops the build, rather than ship a reader
 * with a missing page or a chapter without a name: the pictures against the
 * manifest, the PDF against its size, every chapter's name in every language
 * (the English one the book's own), and every plural form a language needs
 * for "192 pages".
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
  /** Page 1 is on the right; then even pages on the left and odd on the right. */
  side: 'left' | 'right';
  /** The chapter the page is in, if any. */
  chapter: BookChapter | null;
  /** The front or back matter the page is in, if it is not in a chapter. */
  section: BookSection | null;
  /** The chapter this page opens, if it opens one. */
  opens: BookChapter | null;
  images: Record<720 | 1440, ImageMetadata>;
  blocks: TextBlock[];
}

/** The widths every page is pictured at. */
export const renditions = [720, 1440] as const;

/** The edition: its date, its pages, its sections and chapters. */
export const book = manifest as typeof manifest & { sections: BookSection[]; chapters: BookChapter[] };
export const chapters: BookChapter[] = book.chapters;
export const sections: BookSection[] = book.sections;

/** A page's picture file name: p001-720.webp. */
const fileName = (n: number, width: number) => `p${String(n).padStart(3, '0')}-${width}.webp`;

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/book/pages/*.webp', { eager: true });
const images = new Map(Object.entries(files).map(([path, module]) => [path.split('/').pop()!, module.default]));
const text = JSON.parse(textJson) as { pages: { n: number; blocks: TextBlock[] }[] };

const fail = (message: string): never => {
  throw new Error(`Hevalo's book (src/assets/book): ${message}`);
};

// ---- Checks, at build ------------------------------------------------------

if (images.size !== book.pageCount * renditions.length) fail(`${images.size} page pictures, expected ${book.pageCount * renditions.length}`);
if (text.pages.length !== book.pageCount) fail(`text.json has ${text.pages.length} pages, book.json ${book.pageCount}`);
const ratio = book.pagePt.h / book.pagePt.w;
for (let n = 1; n <= book.pageCount; n++) {
  for (const width of renditions) {
    const image = images.get(fileName(n, width)) ?? fail(`no picture ${fileName(n, width)}`);
    if (image.width !== width || Math.abs(image.height - width * ratio) > 1) fail(`${fileName(n, width)} is ${image.width}×${image.height}`);
  }
}
const pdfBytes = statSync(join(process.cwd(), 'public', bookSite.pdf)).size;
if (pdfBytes !== book.pdf.bytes) fail(`public${bookSite.pdf} is ${pdfBytes} bytes, book.json says ${book.pdf.bytes}`);
for (const { code, intl } of locales) {
  const t = messages(code).book;
  for (const chapter of chapters) {
    const name = t.chapters[chapter.number - 1];
    if (!name) fail(`chapter ${chapter.number} has no name in src/i18n/messages/${code}.ts (book.chapters)`);
    if (code === 'en' && name !== chapter.titleEn) fail(`chapter ${chapter.number} is “${chapter.titleEn}”, but book.chapters in en.ts says “${name}”`);
  }
  for (const category of new Intl.PluralRules(intl).resolvedOptions().pluralCategories) {
    if (!(category in t.pageCount)) fail(`book.pageCount in ${code}.ts has no “${category}” form`);
  }
}

// ---- Pages -----------------------------------------------------------------

const within = <T extends { start: number; end: number }>(list: T[], n: number) => list.find((item) => item.start <= n && n <= item.end) ?? null;

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
 * How wide a page is drawn, for the browser to choose its picture: two pages
 * side by side where the screen is wide (half its width, or as the height
 * leaves under the header, the bars and the room above and below), one at a
 * time on a phone (its width less the margins). An estimate, as the reader's
 * stage decides the real size; close enough to choose between 720 and 1440.
 */
export const pageSizes =
  '(min-aspect-ratio: 5/4) and (min-width: 600px) min(calc(50vw - 2rem), calc(70.5vh - 8.25rem)), min(calc(100vw - 2rem), calc(70.5vh - 9.75rem))';

// ---- Words for the page ------------------------------------------------------

/** A number in a language's own digits. */
export const formatNumber = (locale: Locale, value: number) => new Intl.NumberFormat(localeInfo(locale).intl).format(value);

/** "192 pages", in the language's plural form for the number. */
export function pageCountText(locale: Locale, count = book.pageCount): string {
  const forms = messages(locale).book.pageCount;
  const form = forms[new Intl.PluralRules(localeInfo(locale).intl).select(count)] ?? forms.other;
  return form.replace('{n}', formatNumber(locale, count));
}

/** The PDF's size in megabytes, as the language writes it: "2.6 MB", "2,6 Mo". */
export const pdfSize = (locale: Locale) =>
  new Intl.NumberFormat(localeInfo(locale).intl, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(book.pdf.bytes / 1e6);

/** The edition's date, as the language writes it. */
export const editionDate = (locale: Locale) => formatDate(locale, book.date);

/** A chapter's name in a language. */
export const chapterName = (locale: Locale, chapter: BookChapter) => messages(locale).book.chapters[chapter.number - 1] ?? chapter.titleEn;

/** The CEFR levels the book spans: "A1–B1". */
export const levels = (() => {
  const all = [...new Set(chapters.map((chapter) => chapter.cefr))];
  return all.length > 1 ? `${all[0]}–${all.at(-1)}` : (all[0] ?? '');
})();

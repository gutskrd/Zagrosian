# Hevalo's book

`/book`, with a copy in every locale, publishes _Rêya Kurmancî_, Hevalo's free course book:
twelve chapters of Kurmanji with English alongside. It can be read in the browser or downloaded
as a PDF (`public/book/reya-kurmanci.pdf`).

## Reader

[`BookReader.astro`](../src/components/book/BookReader.astro) holds the markup and
[`src/scripts/book/`](../src/scripts/book/) the behavior. That folder has three modules: `index.ts`
(the reader), `turn.ts` (page-turn animation) and `zoom.ts`.

- **Content first:** every page is an `<article>` in the HTML, with its number as a heading, its
  image (`alt=""`) and its text, Kurmanji marked `lang="ku"`. Only the open pages are displayed, so
  assistive technology stays on them. Without JavaScript the pages render as a scrollable column.
- **Layout:** a two-page spread when the stage is at least 600 px wide and wider than tall
  (decided by a container query). Otherwise, one page at a time.
- **Navigation:**
  - buttons and the arrow keys;
  - Page Up and Page Down;
  - trackpad swipes, which never trigger history navigation;
  - clicking a page, tapping its outer edge, or dragging it;
  - `[` and `]` (AltGr too) for chapters, the contents and a page slider.
  - Rapid clicks queue up to eight turns.
- **Turns** take 550 ms. A two-piece leaf curls as it lifts and settles. The next pages' images are
  decoded ahead of time, and a turn never waits more than 120 ms for them.
- **Views:**
  - zoom (1.5×, 2× and 3×; double tap on touch screens), which loads the sharper images;
  - a scrolling column;
  - text only;
  - full view, which traps focus like a dialog.
- **URL:** the address follows the page (`#page-12`, `#chapter-3`) without adding history entries.
- **Resilience:**
  - A missing image shows a reload prompt.
  - If the reader can't start, the static column remains.
  - With reduced motion, pages change instantly.

## Data and build checks

- **Page images:** every page is a WebP at 720 and 1440 px in `src/assets/book/pages/`. The images
  are imported as assets, so they are fingerprinted and cached for a year.
- **Text:** `text.json` holds each page's words.
- **Edition manifest:** `book.json` holds the edition, page count, chapters and PDF size.
- **Build checks:** [`src/lib/book.ts`](../src/lib/book.ts) fails the build when any of these is
  missing or wrong:
  - a page image;
  - a chapter name in any locale;
  - a plural form;
  - the PDF size.
- **The PDF** is served as an attachment (`application/octet-stream`) with `noindex`, and is
  excluded from prerendering.

## Publishing a new edition

1. In Hevalo's repository, export the book:

   ```sh
   npm run book:export --workspace api -- --out <dir> [chapters…]
   ```

   - The export needs poppler (`poppler-utils` or `brew install poppler`).
   - Export every edition on the same machine. A different poppler or WebP encoder renders
     slightly different pixels, and every image would change.

2. Here, import it:

   ```sh
   node scripts/book.mjs <dir>
   ```

   - The script validates the edition. It does nothing if the pages, text and PDF are unchanged:
     the edition name is a hash of all three.
   - Otherwise it replaces `src/assets/book/`, copies the PDF, reports the changed pages and
     redraws `public/og/book.jpg`.

3. If a chapter was added or renamed, add its name to `book.chapters` in every message file. The
   build lists any that are missing.
4. Run `npm run build` and `npm test`, then commit the edition together with the code.

Each edition adds about 45 MB to the repository's history. Keep editions infrequent. If the
repository grows too large, move the page images to R2 on the same origin.

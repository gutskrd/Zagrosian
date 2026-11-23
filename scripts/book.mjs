// Imports an edition of Hevalo's book. Hevalo's export (`npm run book:export --workspace api --
// --out <dir>` in the Hevalo repo) writes the PDF, every page as WebP at 720 and 1440px wide, each
// page's text (text.json) and a manifest (book.json); the book page (src/pages/book.astro) is built
// from these.
//
// Validates the edition first and stops at the first problem: page count, both renditions of every
// page at the right sizes, text on every page, contiguous chapters, the PDF against its recorded
// size and hash, and no file over Cloudflare's 25 MiB limit. An edition whose pages, text and PDF
// match what's already here (the edition name includes a content hash of all three, excluding the
// PDF's timestamp) is a no-op. Otherwise it replaces src/assets/book/ entirely, copies the PDF to
// public/book/, reports which pages changed, and renders the social image (public/og/book.jpg, JPEG
// to stay well under messaging apps' preview size limits): the open book on the site's dark
// background with the white logo, and no text in any language (the title is on the cover).
//
// Usage: node scripts/book.mjs <edition dir>, then npm run build
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = join(root, 'src/assets/book');
const PDF = join(root, 'public/book/reya-kurmanci.pdf');
const OG = join(root, 'public/og/book.jpg');
const LIMIT = 25 * 1024 * 1024;

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/book.mjs <edition dir>');
  process.exit(2);
}
const dir = resolve(source);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pageFile = (n, width) => `p${String(n).padStart(3, '0')}-${width}.webp`;
const fail = (message) => {
  console.error(`book.mjs: ${message}`);
  process.exit(1);
};
const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;

// --- Validation ---

const book = JSON.parse(await readFile(join(dir, 'book.json'), 'utf8'));
const textRaw = await readFile(join(dir, 'text.json'), 'utf8');
const text = JSON.parse(textRaw);
const { pageCount, renditions } = book;

if (!Number.isInteger(pageCount) || pageCount < 4) fail(`book.json gives ${pageCount} pages`);
if (JSON.stringify(renditions) !== JSON.stringify([720, 1440])) fail(`renditions ${JSON.stringify(renditions)}, expected [720, 1440]`);
if (text.pages?.length !== pageCount) fail(`text.json has ${text.pages?.length} pages, book.json ${pageCount}`);

const ratio = book.pagePt.h / book.pagePt.w;
const files = (await readdir(join(dir, 'pages'))).filter((name) => name.endsWith('.webp'));
if (files.length !== pageCount * renditions.length) fail(`pages/ holds ${files.length} pictures, expected ${pageCount * renditions.length}`);
const hashes = new Map();
for (let n = 1; n <= pageCount; n++) {
  for (const width of renditions) {
    const file = join(dir, 'pages', pageFile(n, width));
    const bytes = await readFile(file).catch(() => fail(`page ${n} has no picture ${width} pixels wide`));
    const meta = await sharp(bytes).metadata();
    if (meta.format !== 'webp' || meta.width !== width || Math.abs(meta.height - width * ratio) > 1) {
      fail(`${pageFile(n, width)} is ${meta.format} ${meta.width}×${meta.height}, expected WebP ${width}×${Math.round(width * ratio)}`);
    }
    if (bytes.length > LIMIT) fail(`${pageFile(n, width)} is over 25 MiB`);
    hashes.set(pageFile(n, width), sha256(bytes));
  }
  const page = text.pages[n - 1];
  if (page.n !== n || !Array.isArray(page.blocks) || page.blocks.length === 0) fail(`page ${n} has no words in text.json`);
}

let next = null;
for (const chapter of book.chapters) {
  if (next !== null && chapter.start !== next) fail(`chapter ${chapter.number} starts on page ${chapter.start}, not right after the one before (${next})`);
  if (chapter.end < chapter.start) fail(`chapter ${chapter.number} ends before it starts`);
  next = chapter.end + 1;
}

const pdfBytes = await readFile(join(dir, book.pdf.file));
if (pdfBytes.length !== book.pdf.bytes || sha256(pdfBytes) !== book.pdf.sha256) fail(`${book.pdf.file} does not match the size and hash book.json records`);
if (pdfBytes.length > LIMIT || Buffer.byteLength(textRaw) > LIMIT) fail('a file is over 25 MiB');

// --- Unchanged editions ---

const contentHash = (edition) => String(edition ?? '').split('.')[1];
const installed = await readFile(join(ASSETS, 'book.json'), 'utf8')
  .then((raw) => JSON.parse(raw))
  .catch(() => null);
const present = async (file) => stat(file).then(() => true, () => false);
// (A run that stopped before rendering the social image completes it next time.)
if (installed && contentHash(installed.edition) === contentHash(book.edition) && (await present(PDF)) && (await present(OG))) {
  console.log(`unchanged: edition ${installed.edition} is already in the site`);
  process.exit(0);
}

// --- Install ---

const before = new Map();
if (installed) {
  for (const name of await readdir(join(ASSETS, 'pages')).catch(() => [])) {
    before.set(name, sha256(await readFile(join(ASSETS, 'pages', name))));
  }
}

await rm(ASSETS, { recursive: true, force: true });
await mkdir(join(ASSETS, 'pages'), { recursive: true });
await cp(join(dir, 'pages'), join(ASSETS, 'pages'), { recursive: true, filter: (from) => !/\.(?!webp$)[^/.]+$/.test(from) });
await writeFile(join(ASSETS, 'book.json'), `${JSON.stringify(book, null, 2)}\n`);
await writeFile(join(ASSETS, 'text.json'), textRaw);
await mkdir(join(root, 'public/book'), { recursive: true });
await writeFile(PDF, pdfBytes);

let weight = (await stat(PDF)).size + Buffer.byteLength(textRaw);
for (const name of hashes.keys()) weight += (await stat(join(ASSETS, 'pages', name))).size;
const changed = [];
for (let n = 1; n <= pageCount; n++) {
  if (renditions.some((width) => before.get(pageFile(n, width)) !== hashes.get(pageFile(n, width)))) changed.push(n);
}
console.log(`edition ${book.edition}: ${pageCount} pages, ${book.chapters.length} chapters, ${mb(weight)} in all (PDF ${mb(pdfBytes.length)})`);
console.log(installed ? `pages changed: ${changed.length === 0 ? 'none (the words or the PDF did)' : changed.join(', ')}` : 'first edition');
if (installed && changed.length === pageCount) {
  // The same book rendered by a different poppler or WebP encoder version differs slightly on every
  // page.
  console.log('every page changed: if the book itself did not, the export ran with other versions of poppler or sharp than the last');
}


// --- Social image ---

// The open book as the reader shows it: the cover in front, slightly rotated, with the first spread
// open behind it, on the dark background of the other social images, under a faint patch of
// sunlight.
const dataUrl = async (file) => `data:image/webp;base64,${(await readFile(file)).toString('base64')}`;
const [cover, left, right] = await Promise.all([1, 2, 3].map((n) => dataUrl(join(ASSETS, 'pages', pageFile(n, 1440)))));
const logo = (await readFile(join(root, 'src/assets/brand/zagrosian-logo-light.svg'), 'utf8')).replace('<svg ', '<svg class="logo" ');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html><style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #0a0a0a; color: #fff; }
  .sun { position: absolute; inset: 0; background: radial-gradient(ellipse 46% 60% at 66% 46%, rgb(241 178 102 / 0.16), transparent 70%); }
  .logo { position: absolute; left: 80px; top: 78px; width: 74px; height: auto; }
  .scene { position: absolute; left: 330px; top: 70px; width: 780px; height: 490px; perspective: 2200px; }
  .spread { position: absolute; left: 0; top: 34px; width: 640px; height: 454px; display: flex; transform: rotateX(16deg) rotateZ(-4deg); transform-origin: 50% 100%; box-shadow: 0 40px 70px -20px rgb(0 0 0 / 0.9); }
  .spread img { width: 320px; height: 454px; display: block; filter: brightness(0.82); }
  .spread::after { content: ''; position: absolute; left: 300px; width: 40px; top: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgb(0 0 0 / 0.28), transparent); }
  .cover { position: absolute; left: 440px; top: 0; width: 340px; height: 482px; transform: rotateY(-14deg) rotateZ(3deg); transform-origin: 0 50%; box-shadow: -18px 30px 60px -10px rgb(0 0 0 / 0.85); border-radius: 2px 6px 6px 2px; overflow: hidden; }
  .cover img { width: 100%; height: 100%; display: block; }
  .cover::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, rgb(255 255 255 / 0.16), transparent 30%, transparent 80%, rgb(0 0 0 / 0.12)); }
</style>
<div class="sun"></div>${logo}
<div class="scene">
  <div class="spread"><img src="${left}" alt=""><img src="${right}" alt=""></div>
  <div class="cover"><img src="${cover}" alt=""></div>
</div>`);
await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
const png = await page.screenshot({ type: 'png' });
await browser.close();
await mkdir(join(root, 'public/og'), { recursive: true });
await sharp(png).resize(1200, 630).jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(OG);
// The share image used to be a PNG.
await rm(join(root, 'public/og/book.png'), { force: true });
console.log(`public/og/book.jpg (${Math.round((await stat(OG)).size / 1000)} kB)`);

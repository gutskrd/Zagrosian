# zagrosian.com

The website of Zagrosian, the company behind [Hevalo](https://hevalo.app). It is a static
[Astro](https://astro.build) site served from Cloudflare Workers in ten languages. There are no
cookies, no analytics and no third-party requests.

- **Stack:** Astro 7, strict TypeScript and plain CSS. The browser gets no UI framework and no
  client-side libraries.
- **Hosting:** Cloudflare Workers static assets, behind a small Worker that handles redirects
  ([`worker/`](worker/)).
- **Quality:** Playwright end-to-end, layout and accessibility tests (axe, WCAG 2.2 AA),
  Lighthouse CI, ESLint and Prettier, all run on every push.

## Getting started

Requires Node 22.12 or later ([`.node-version`](.node-version)).

```sh
npm ci
npm run dev    # http://localhost:4321
```

| Script             | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `npm run dev`      | Dev server with hot reload                                                    |
| `npm run build`    | Type-check (`astro check`), then build to `dist/`                             |
| `npm run preview`  | Build, then serve on port 8787 with Wrangler as in production (headers, 404s) |
| `npm test`         | Playwright suite against the built site (run `npm run build` first)           |
| `npm run lint`     | ESLint                                                                        |
| `npm run format`   | Prettier; `npm run format:check` verifies formatting without writing          |
| `npm run check`    | Type-check only                                                               |
| `npm run deploy`   | Build and deploy with Wrangler (production normally deploys from GitHub)      |
| `npm run indexnow` | Submit the live sitemap to IndexNow (CI does this after each deploy)          |

## Project structure

```
src/
  pages/            Routes: English at the root, other locales under [lang]/. The sitemap,
                    llms.txt, Markdown versions, registration.json and security.txt are endpoints.
  views/            One view per page type, shared by a root route and its [lang] twin
  layouts/          BaseLayout (document head, SEO, structured data), LegalLayout, NoticeLayout
  components/
    layout/         Header, footer, site and language menus, command menu, theme and sound
    home/           Homepage sections and their parts
    book/           The book reader
    ui/             Shared primitives: buttons, logo, icons, text effects
  scripts/          Client-side code, bundled from a single entry point (main.ts)
    book/           Book reader: page turns, zoom
    hevalo/         Hevalo's deer and pointer-following eyes
    motion/         Animation runtime, homepage story, scroll reveals
    rug/            WebGL rug, cloth simulation, paper plane
    sound/          Sound preference and the lazy-loaded synthesizer
    utils/          Popover fallback, device heuristics, math helpers
  lib/              Build-time data: structured data, Markdown and llms.txt, FAQ, book edition
  i18n/             Locales, URL helpers and messages (one file per language)
  content/legal/    Privacy policy, terms and security policy in Markdown, per language
  styles/           Design tokens and global styles
  assets/           Images, fonts and book pages, fingerprinted at build time
  site.ts           Facts that don't vary by language: names, addresses, profiles, registration
public/             Served as-is: icons, social images, robots.txt, _headers, the book's PDF
worker/             HTTPS and www redirects, security.txt expiry
scripts/            Asset generators (rug, deer layers, logo shadows, book import) and IndexNow
tests/              Playwright specs
docs/               Architecture, brand assets, the book, operations
```

## Editing content

- **Text** lives in [`src/i18n/messages/`](src/i18n/messages/), one file per language. `en.ts`
  defines the shape and every other locale is type-checked against it, so a missing or extra
  string fails the build. Pages, their Markdown versions and `llms.txt` are all generated from
  these files.
- **Facts that don't vary by language** live in [`src/site.ts`](src/site.ts): the company name,
  email addresses, social profiles, Kurdish phrases, the IndexNow key and the company
  registration.
- **Legal pages** are in [`src/content/legal/`](src/content/legal/). English is authoritative and
  each translation says so. When a policy changes, update every language and its `updated` date,
  which also drives the sitemap's `lastmod`.
- **Email addresses:** only `contact@` and `privacy@` are published, and both have an inbox. Don't
  publish an address until someone reads it. A privacy request has a one-month legal deadline.
- **Registration details** (address, KvK number, phone) must be visible on the site but kept out of
  search. They are loaded into the footer from `/registration.json`, which is disallowed in
  `robots.txt`, served with `noindex`, and wrapped in `data-nosnippet`. A test checks that no
  built page contains them.
- **Homepage date:** when homepage copy changes, bump `updated` in `src/site.ts` so the sitemap
  reflects it.

## Languages

| Language           | Code  | Path   | Direction |
| ------------------ | ----- | ------ | --------- |
| English (default)  | `en`  | `/`    | LTR       |
| Kurdish (Kurmanji) | `ku`  | `/ku`  | LTR       |
| Kurdish (Sorani)   | `ckb` | `/ckb` | RTL       |
| Dutch              | `nl`  | `/nl`  | LTR       |
| German             | `de`  | `/de`  | LTR       |
| Spanish            | `es`  | `/es`  | LTR       |
| French             | `fr`  | `/fr`  | LTR       |
| Turkish            | `tr`  | `/tr`  | LTR       |
| Arabic             | `ar`  | `/ar`  | RTL       |
| Persian            | `fa`  | `/fa`  | RTL       |

Every page exists in every language under the locale prefix, each with its own 404 page. The
locale comes from the URL, so all pages are static and indexable. Each page has `hreflang`
alternates (plus `x-default`), and so does the sitemap. Layout uses logical properties, so RTL
mirrors automatically. Persian uses Solar Hijri dates and Persian digits.

To add a language:

1. Add it to `locales` in [`src/i18n/locales.ts`](src/i18n/locales.ts).
2. Add a message file and import it in `src/i18n/index.ts`.
3. Add its legal pages under `src/content/legal/<code>/`.
4. Add its `Content-Language` rules to `public/_headers`.
5. Add a social image at `public/og/<code>.png`.

The build fails if the message file or any legal page is missing.

## Testing

Tests run against the production build, served by Wrangler with the production headers
([`tests/wrangler.jsonc`](tests/wrangler.jsonc)).

```sh
npx playwright install chromium        # once
npm run build
npm test                               # full suite
npx playwright test tests/seo.spec.ts  # one file
```

| Spec                    | Covers                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `security.spec.ts`      | Security headers, Worker redirects, security.txt, CSP violations on every page                                    |
| `accessibility.spec.ts` | axe (WCAG 2.2 AA) on every page and locale, light and dark, desktop and mobile                                    |
| `layout.spec.ts`        | No overflow or clipping at six widths from 320 to 1920 px; tap target sizes                                       |
| `seo.spec.ts`           | Titles, descriptions, canonicals, `hreflang`, structured data, sitemap, privacy of registration details, favicons |
| `stability.spec.ts`     | No layout shift on load or while scrolling, LTR and RTL                                                           |
| `interactions.spec.ts`  | Language menu and suggestion, site menu, theme switching, sharing                                                 |
| `menu.spec.ts`          | Menus in every language and at six widths, including the Popover API fallback                                     |
| `deer.spec.ts`          | The deer's scroll-driven entrance                                                                                 |
| `rug.spec.ts`           | Rug interaction with mouse and touch, reset on scroll, reduced motion                                             |
| `plane.spec.ts`         | The paper plane's flight and landing on desktop and mobile                                                        |
| `book.spec.ts`          | The book reader: navigation, gestures, zoom, views, RTL, no-JS and failure modes                                  |

CI ([`.github/workflows/checks.yml`](.github/workflows/checks.yml)) runs lint, the test suite and
Lighthouse on every push. Lighthouse requires 100 for accessibility, best practices and SEO
([`lighthouserc.json`](lighthouserc.json)). Performance below 90 is reported as a warning, because
CI runners vary in speed.

## Deployment

Cloudflare Workers Builds deploys the default branch on every push, using
[`wrangler.jsonc`](wrangler.jsonc). The Worker ([`worker/index.ts`](worker/index.ts)) runs in front
of everything except the fingerprinted files in `/_astro/`:

- it redirects HTTP to HTTPS on the same host first, as HSTS preload requires;
- it redirects `www.zagrosian.com` to `zagrosian.com`;
- it keeps `security.txt`'s `Expires` date 180 days ahead.

After a successful deploy, the _Search engines_ workflow submits the sitemap to IndexNow. Dashboard
settings, Search Console setup and recommended account security are covered in
[`docs/operations.md`](docs/operations.md).

## Security

The site is static, with no accounts, forms or user input. [`public/_headers`](public/_headers)
sets the following:

- a strict Content-Security-Policy: same-origin only, no inline code, Trusted Types enforced;
- HSTS for two years with `includeSubDomains` and `preload`;
- COOP, COEP and CORP;
- `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy;
- a Permissions-Policy that disables powerful features.

Any third-party script (analytics, embeds) has to be allowed in the CSP and disclosed in the
privacy policy. Report vulnerabilities as described in
[`/.well-known/security.txt`](https://zagrosian.com/.well-known/security.txt).

## Documentation

- [Architecture](docs/architecture.md): rendering, client scripts, motion, browser support,
  performance
- [Brand assets](docs/brand.md): logos, icons, rug, deer, fonts, and how to regenerate them
- [Hevalo's book](docs/book.md): the reader and publishing a new edition
- [Operations](docs/operations.md): Cloudflare, search engines, DNS and account security
- [TODO](TODO.md): open decisions and work that needs people or access

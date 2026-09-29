# zagrosian.com

The website of Zagrosian, the technology company behind [Hevalo](https://hevalo.app).

Built with [Astro](https://astro.build) as a fully static site: no server, no database, no forms, no
cookies and no third-party requests. Available in the nine languages of Hevalo: Kurdish (Kurmanji and
Sorani), English, Dutch, German, Spanish, French, Turkish and Arabic.

## Commands

Requires Node 22.12 or later.

| Command           | Action                                           |
| ----------------- | ------------------------------------------------ |
| `npm install`     | Install dependencies                             |
| `npm run dev`     | Start the dev server at `http://localhost:4321`  |
| `npm run check`   | Type-check `.astro` and `.ts` files              |
| `npm run build`   | Type-check, then build the site into `dist/`     |
| `npm run preview` | Build, then serve the site at `http://localhost:8787` exactly as Cloudflare does, with the headers from `public/_headers`, clean URLs and the 404 page. Rebuilds when files in `src/` change |
| `npm run deploy`  | Build and deploy to Cloudflare (after `npx wrangler login`); normally Cloudflare deploys from GitHub instead |

## Editing content

- [`src/i18n/messages/`](src/i18n/messages/): all interface and homepage text, one file per language
  (see **Languages** below). The homepage, its Markdown versions and `llms.txt` are built from these
  files, so change text there rather than in the components.
- [`src/site.ts`](src/site.ts): facts that are the same in every language: company name, country,
  Hevalo's name and address, the Kurdish phrases, social profiles and the email addresses. Each address
  appears only where it is needed:

  | Address                 | Where it appears                                       |
  | ----------------------- | ------------------------------------------------------ |
  | `contact@zagrosian.com` | Contact section, security policy and `security.txt`   |
  | `press@zagrosian.com`   | Contact section (one line for journalists)             |
  | `privacy@zagrosian.com` | Privacy policy                                         |
  | `legal@zagrosian.com`   | Terms of use                                           |
  | `careers@zagrosian.com` | Privacy policy (job applications); add it to a careers page when you have one |
  | `hello@zagrosian.com`   | Not on the site                                        |

- Social profiles (Instagram [@zagrosiano](https://www.instagram.com/zagrosiano/), TikTok
  [@zagrosianofficial](https://www.tiktok.com/@zagrosianofficial)) are listed in `socialProfiles` in
  `src/site.ts`. They appear in the footer and in the homepage structured data (`sameAs`), which helps
  Google connect them to the company. The icons are inline SVGs from
  [Simple Icons](https://simpleicons.org) (CC0), so the site never loads anything from either platform.
  If you add or remove a profile, update the Social media section of the privacy policy too.
- Kurdish phrases (marked `lang="ku"`, so screen readers and search engines treat them as Kurdish):
  *Jiyan bi kurdî xweştire.* ("Life is sweeter in Kurdish", Hevalo's motto) is the large statement after
  the Hevalo section, in [`Motto.astro`](src/components/Motto.astro), with a translation underneath in
  every language except Kurmanji (`motto` in the message files). *Ji Kurdan, ji bo Kurdan.*
  ("By Kurds, for Kurds") is in the footer. Both stay in Kurmanji in every language and use the
  `kurdish` class, which sets them in the same serif italic as hevalo.app (see **Fonts** below).
- The Hevalo section ends with a *Coming soon* note for the iOS and Android apps, in
  [`ProductShowcase.astro`](src/components/ProductShowcase.astro) (text: `hevalo.comingSoon*` in the
  message files). When the apps are out, replace it with links to the App Store and Google Play.
- [`src/components/`](src/components/): homepage sections.
- [`src/content/legal/`](src/content/legal/): the privacy policy, terms of use and security policy,
  written in Markdown, with one folder per language (`en/privacy.md`, `de/privacy.md`, …). English is
  the original; each translated page says so and links to it. When you change a page, change every
  language and update each `updated:` date. Email addresses and company details are written out in
  these files, so update them there too if they change.

## Structure

```
public/            Favicons, logo, social images (og.png and og/<language>.png), manifest,
                   robots.txt and Cloudflare _headers
src/
  assets/brand/    Griffin emblem, the 21-ray sun and the Hevalo app icon (sources and sized variants)
  assets/fonts/    Inter subset with the Turkish and Kurmanji letters Ğ ğ İ Ş ş
  components/      Header, Footer, Hero, ProductShowcase, Motto, About, Contact, CommandMenu,
                   LanguagePicker, LanguageSuggestion, ThemeToggle, ThemeSwitch, …
  content/legal/   Legal pages in Markdown, one folder per language
  i18n/            locales.ts (the languages), index.ts (URL helpers) and messages/ (the text)
  layouts/         BaseLayout (document, SEO and structured data), LegalLayout (legal pages),
                   NoticeLayout (404)
  lib/             structured-data.ts (JSON-LD) and pages.ts (Markdown versions and llms.txt)
  pages/           English pages at the root, other languages under [lang]/; sitemap.xml, llms.txt,
                   llms-full.txt, the Markdown versions ([page].md.ts) and .well-known/security.txt
  scripts/         site.ts (header, mobile menu, section highlighting, scroll reveals, copy button,
                   local time, legal page tools), command.ts (quick navigation), motion.ts,
                   language.ts, theme.ts and theme-init.js
  styles/          Fonts, design tokens and base styles
  site.ts          Facts that are the same in every language
```

## Brand assets

- **Griffin** (`src/assets/brand/griffin-source.png`): the emblem, used in the header, the hero, the
  Google logo (`public/logo.png`) and the social images (`public/og.png` in English and
  `public/og/<language>.png`, which also show the hero headline in that language; update them if the
  headline changes). The site serves it as
  16-colour PNGs at 96–960 px wide (`griffin-*.png`), which for black line art are smaller than WebP or
  AVIF. To regenerate a variant:
  `node -e "require('sharp')('src/assets/brand/griffin-source.png').resize({ width: 480 }).png({ palette: true, colours: 16, dither: 0 }).toFile('src/assets/brand/griffin-480.png')"`
- **Sun** (`src/assets/brand/sun-black-source.png` and `sun-white-source.png`): the 21-ray sun. The
  Kurdish motto section uses the black version on light backgrounds and the white version in dark mode
  (`sun-*-64.png`, cropped to the sun). The favicon and app icons show the white sun on a black tile.
- **Hevalo icon** (`src/assets/brand/hevalo-source.png`): Hevalo's app icon, shown above the product
  name and in the hero's *coming soon* notice. The source's corners are semi-transparent white; the
  served versions (`hevalo-96/192/288.webp`) have them made fully transparent, so the icon sits cleanly
  on dark backgrounds.

- **Fonts:** Latin text is set in Inter and Arabic script (Arabic and Sorani) in
  [Vazirmatn](https://github.com/rastikerdar/vazirmatn), both self-hosted variable fonts under the OFL.
  Vazirmatn is designed to match Latin sans-serifs like Inter and covers the Sorani letters (ڕ ڵ ۆ ێ
  ە). The browser downloads it only when Arabic script is on screen: on Arabic and Sorani pages, and
  elsewhere when the visitor reaches for the language menu, which lists those two languages in their
  own script. Kurdish phrases use the `kurdish`
  class in `src/styles/global.css`, the same serif italic as hevalo.app:
  `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif`. These are
  fonts already on the visitor's device (Iowan Old Style on Apple devices, Palatino Linotype on
  Windows), so nothing is downloaded. Widths differ between them, so the motto's size leaves room for
  the widest.

  Inter's main file covers basic Latin, which already includes every letter of Dutch, German, Spanish
  and French, and ç, ö, ü, ê, î and û; `src/assets/fonts/inter-latin-extra-opsz.woff2` adds the five
  letters still missing for Turkish and Kurmanji (Ğ ğ İ Ş ş), and loads only on pages that use them.
  It was cut from Fontsource's Inter Latin Extended file (OFL) with fontTools:
  `pyftsubset node_modules/@fontsource-variable/inter/files/inter-latin-ext-opsz-normal.woff2
  --unicodes=U+011E,U+011F,U+0130,U+015E,U+015F --layout-features='*' --flavor=woff2
  --output-file=src/assets/fonts/inter-latin-extra-opsz.woff2`.

## Light and dark theme

The site follows the visitor's system setting by default. The sun/moon button in the header switches
between light and dark, and the control in the footer offers *System*, *Light* and *Dark*. The
choice is saved in the browser (`localStorage`) and applies to every open tab at once.

- [`src/scripts/theme-init.js`](src/scripts/theme-init.js) is a tiny blocking script in `<head>`
  that sets `data-theme` on `<html>` before the page is drawn, so the wrong colours never flash. It
  is an external file because the Content-Security-Policy forbids inline scripts.
- [`src/scripts/theme.ts`](src/scripts/theme.ts) runs the controls. Where the browser supports view
  transitions, the new theme spreads out in a circle from the control that was used; with *reduce
  motion* it changes instantly. It also updates the browser toolbar colour (`theme-color`) and
  follows system changes while *System* is selected.
- Colours are tokens in `src/styles/global.css`, with the dark values under
  `:root[data-theme='dark']`; line art is inverted on dark surfaces. Without JavaScript the site stays
  light and the controls are hidden.

## Motion

Animation is handled by [`src/scripts/motion.ts`](src/scripts/motion.ts) with no dependencies, using
the Web Animations API, IntersectionObserver and a single requestAnimationFrame loop:

- **Hero:** the headline rises line by line from behind masks on load; the griffin fades in and
  drifts slightly slower than the page (`data-parallax`).
- **Headings:** [`SplitText`](src/components/SplitText.astro) splits a heading into words at build
  time. `effect="rise"` makes the words rise one after another as it enters the viewport;
  `effect="highlight"` brightens them as the reader scrolls past (the About statement).
- **Sections:** blocks marked `data-reveal` fade up; elements with the `rule` class draw their top
  hairline across.
- **Motto:** the sun turns slowly as the section scrolls past (`data-spin`), and the Kurdish
  sentence rises word by word.
- **Footer:** the Zagrosian wordmark rises out of its baseline as the footer appears (`data-rise`).
- **Pointer depth:** with a mouse, the hero griffin leans slightly towards the pointer and the Hevalo
  icon tilts under it with a soft highlight. Touch screens and *reduce motion* get none of this.
- **Legal pages:** a reading-progress bar and the current section highlighted in the contents.

Rules the code follows:

- Only `transform`, `opacity` and colour change, so animations stay smooth on the compositor.
- Everything is visible without JavaScript, and nothing moves when the visitor has turned on
  *reduce motion*.
- No HTML is generated in the browser and no `style` attributes are written, so the
  Content-Security-Policy and Trusted Types rules in `public/_headers` stay strict.
- Split headings keep their full text as their accessible name.

## Readable by machines

Besides the pages themselves, the site describes itself in formats that search engines, AI assistants
and other tools read directly:

- **Structured data:** every page carries a schema.org JSON-LD graph
  ([`src/lib/structured-data.ts`](src/lib/structured-data.ts)): the WebSite, the Organization (logo,
  contact points, social profiles, the Hevalo brand) and the page itself, with breadcrumbs and a
  last-modified date on the legal pages. Nodes refer to each other by `@id`, so they form one
  description of the company.
- **Markdown versions:** every page, in every language, is also published as Markdown (`/index.md`,
  `/privacy.md`, `/de/index.md`, `/de/privacy.md`, …) and linked from the page with
  `<link rel="alternate" type="text/markdown">`.
- **llms.txt:** [`/llms.txt`](https://zagrosian.com/llms.txt) is a short overview for language models
  in the [llms.txt](https://llmstxt.org) format, with links to every language, and `/llms-full.txt` has
  the text of every English page in one file. Both are built from the same content as the pages
  ([`src/lib/pages.ts`](src/lib/pages.ts)).
- **Sitemap, robots.txt, web app manifest and security.txt** complete the picture.

The Markdown and text files are marked `noindex`, so search results always show the real pages.

## Languages

The site is in the same nine languages as Hevalo, listed in
[`src/i18n/locales.ts`](src/i18n/locales.ts):

| Language            | Code  | Address         | Direction     |
| ------------------- | ----- | --------------- | ------------- |
| English (default)   | `en`  | `/`             | left to right |
| Kurdish (Kurmanji)  | `ku`  | `/ku`           | left to right |
| Kurdish (Sorani)    | `ckb` | `/ckb`          | right to left |
| Dutch               | `nl`  | `/nl`           | left to right |
| German              | `de`  | `/de`           | left to right |
| Spanish             | `es`  | `/es`           | left to right |
| French              | `fr`  | `/fr`           | left to right |
| Turkish             | `tr`  | `/tr`           | left to right |
| Arabic              | `ar`  | `/ar`           | right to left |

Every page exists in every language at the same path under the language's prefix (`/privacy`,
`/de/privacy`, `/ar/privacy`), each with its own 404 page. The language is read from the address, so
pages are fully static and every language can be indexed.

- **Text:** [`src/i18n/messages/en.ts`](src/i18n/messages/en.ts) defines every string; each other
  language file has the same shape, so a missing or extra string is a type error at build time.
  The Kurdish and Arabic translations use the same words as Hevalo's own interface where they overlap.
  Brand and product names stay in Latin script.
- **Choosing a language:** the globe button in the header opens a menu with every language, each
  written in that language (a native popover, so it works with keyboard and screen readers and needs
  no script to open). On phones the list is in the menu. Visitors whose browser prefers another
  available language see a small suggestion to switch, written in that language; it never redirects.
  Once they choose or dismiss it, it does not appear again (`language-chosen` in `localStorage`, which
  the privacy policy mentions).
- **Right to left:** Arabic and Sorani pages set `dir="rtl"`. Layout uses logical CSS properties, so
  it mirrors by itself; arrows flip, and Arabic script gets no letter-spacing and taller lines. Latin
  text inside them (brand names, email addresses, the Kurmanji motto) keeps its own direction and
  spacing.
- **Long words:** German and Dutch headings are hyphenated where the browser supports it; legal titles
  with long compounds (such as *Datenschutzerklärung*) are sized so the word fits a phone screen, and
  as a last resort a word breaks rather than overflowing.
- **Search engines:** every page lists all its translations with `hreflang` links (plus `x-default`
  for English), in the page and in the sitemap. Each page has its own `og:locale` and social image
  (`public/og/<code>.png`), the structured data gives each page's language, and Cloudflare sends a
  matching `Content-Language` header (`public/_headers`).
- **Legal pages:** the English text is the original. Translations carry a notice that the English
  version applies if they differ. Have translations reviewed by a native speaker, and a lawyer where it
  matters, before relying on them.

To add a language: add it to `locales` in `src/i18n/locales.ts` (with the locale used to format its
dates and numbers), add a message file in
`src/i18n/messages/` and import it in `src/i18n/index.ts`, add its legal pages under
`src/content/legal/<code>/`, add its two `Content-Language` rules to `public/_headers`, and make its
social image `public/og/<code>.png`. The build fails if the message file or any of the legal pages
is missing.

## Browser features

- **Quick navigation:** Ctrl K (⌘K on Apple devices), the `/` key or the search button in the header
  opens a searchable list of every page, section, language and theme, with a few actions (visit
  Hevalo, copy the email address). It is keyboard-first (arrow keys, Enter, Escape), follows the ARIA
  combobox pattern for screen readers, and finds entries by their English name too, so *privacy*
  also finds *Datenschutz*. The entries are written at build time in
  [`CommandMenu.astro`](src/components/CommandMenu.astro); [`command.ts`](src/scripts/command.ts)
  only filters and highlights them.
- **Legal pages:** each shows its reading time, a print button (which also saves as PDF, with a
  print layout) and, beside every section heading, a button that copies a link to that section.
- **Local time:** the About section shows the current time at the headquarters, formatted for the
  page's language (`timeZone` in `src/site.ts`).

- **Instant navigation:** a `Speculation-Rules` header points Chrome and Edge to
  [`public/speculation-rules.json`](public/speculation-rules.json), which prerenders a page on this site
  when a visitor hovers or starts to tap a link to it. Other browsers ignore it.
- **Page transitions:** browsers that support cross-document view transitions cross-fade between
  pages, with the header staying in place.
- **Accessibility preferences:** besides light and dark mode and *reduce motion*, the site responds to
  *increase contrast* (darker secondary text and lines) and to Windows' forced colours (high contrast),
  where buttons get outlines and drawn marks use the system text colour.

## Deploying to Cloudflare

The site runs on Cloudflare Workers as static assets, with no Worker script. Everything is configured
in [`wrangler.jsonc`](wrangler.jsonc): the Worker's name (`zagrosian`), the `dist/` folder, clean URLs
(`/privacy` serves `privacy.html`, and `/privacy.html` redirects to it) and the 404 page. `npx wrangler
deploy` runs `npm run build` itself, then uploads the site.

Cloudflare deploys it from GitHub with Workers Builds. In the Cloudflare dashboard, under **Workers &
Pages → zagrosian → Settings → Build**, use:

| Setting                            | Value                                                        |
| ---------------------------------- | ------------------------------------------------------------ |
| Git repository                     | `gutskrd/Zagrosian`                                          |
| Branch (production)                | the branch you deploy from, currently `claude/adoring-brown-aa51uh` |
| Build command                      | leave empty (the deploy command builds the site)             |
| Deploy command                     | `npx wrangler deploy`                                        |
| Non-production branch deploy command | `npx wrangler versions upload`                             |
| Root directory                     | leave empty                                                  |

The Node version is pinned by [`.node-version`](.node-version).

Then, under **Settings → Domains & Routes**, add `zagrosian.com` and `www.zagrosian.com` as custom
domains, and redirect `www.zagrosian.com` to `zagrosian.com` with a Cloudflare redirect rule (**Rules →
Redirect Rules**, template *Redirect from WWW to root*). The Worker's own `*.workers.dev` address and
its preview URLs send `X-Robots-Tag: noindex`, so search engines only index zagrosian.com; you can also
turn them off on the same settings page.

`security.txt` expires 180 days after each build, so redeploy at least twice a year.

## Getting indexed by Google

The site is ready for indexing: every page has a canonical URL, there is a sitemap with the date each
legal page last changed, and every page carries structured data (see **Readable by machines**). Only
zagrosian.com is indexed (see above). Google still needs to be told the site
exists:

1. Check that the latest Cloudflare build is green (the *Workers Builds: zagrosian* check on GitHub)
   and that https://zagrosian.com loads.
2. In [Google Search Console](https://search.google.com/search-console), add a **Domain** property for
   `zagrosian.com`. Verify it with the DNS TXT record Google gives you (in Cloudflare: DNS → Records →
   Add record, type `TXT`, name `@`).
3. In Search Console, open **Sitemaps** and submit `https://zagrosian.com/sitemap.xml`.
4. Use **URL inspection** on `https://zagrosian.com/` and click **Request indexing**.
5. Optionally, import the site into [Bing Webmaster Tools](https://www.bing.com/webmasters) from Search
   Console, and enable **Crawler Hints** in Cloudflare so Bing and others learn about changes quickly.

New sites usually appear for searches on their own name within days to a few weeks.

## Security

The site itself has almost no attack surface: static files, no accounts and no user input. On top of
that, [`public/_headers`](public/_headers) sets:

- a strict **Content-Security-Policy**: only the site's own files load, no inline code runs, and
  Trusted Types are enforced. This is why styles and scripts are built as external files;
- **HSTS** for two years, including subdomains, with the `preload` directive;
- **cross-origin isolation** (COOP, COEP, CORP), `X-Frame-Options: DENY`, `nosniff`, a strict referrer
  policy and a Permissions-Policy that disables every powerful browser feature.

`robots.txt`, `sitemap.xml` and `security.txt` get their own sandboxed policy, so browsers' built-in text
and XML viewers can style them.

If you add a third-party script, such as analytics, embeds or Cloudflare Web Analytics, you must
allow it in the Content-Security-Policy and describe it in the privacy policy.

Recommended settings outside the code:

- **Cloudflare:** enable DNSSEC, set SSL/TLS to *Full (strict)*, turn on *Always Use HTTPS*, set the
  minimum TLS version to 1.2, and add CAA records for the certificate authorities you use.
- **Email:** make sure all six addresses receive mail, including the ones not shown on the site, (for example with Cloudflare Email Routing), and
  add SPF, DKIM and DMARC records so nobody can send email pretending to be zagrosian.com.
- **Accounts:** use two-factor authentication on Cloudflare, GitHub and your domain registrar, and
  enable the registrar lock.
- **HSTS preload:** once the site has run on HTTPS without issues, you can submit the domain at
  [hstspreload.org](https://hstspreload.org). This is hard to undo: every subdomain must then support
  HTTPS.

Dependabot ([`.github/dependabot.yml`](.github/dependabot.yml)) opens monthly dependency update pull
requests. It skips TypeScript 7, which `astro check` does not support yet.

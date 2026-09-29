# zagrosian.com

The website of Zagrosian, the technology company behind [Hevalo](https://hevalo.app).

Built with [Astro](https://astro.build) as a fully static site: no server, no database, no forms, no
cookies and no third-party requests.

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

- [`src/site.ts`](src/site.ts): company name, country, title, description, products, and all
  homepage copy (`home`). The homepage, its Markdown version and `llms.txt` are built from this one
  file, so change text here rather than in the components. It also holds the email addresses shown on
  the homepage. Each address appears only where it is needed:

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
  the Hevalo section, in [`Motto.astro`](src/components/Motto.astro). *Ji Kurdan, ji bo Kurdan.*
  ("By Kurds, for Kurds") is in the footer. Both use the `kurdish` class, which sets them in the same
  serif italic as hevalo.app (see **Fonts** below).
- The Hevalo section ends with a *Coming soon* note for the iOS and Android apps, in
  [`ProductShowcase.astro`](src/components/ProductShowcase.astro). When the apps are out, replace it
  with links to the App Store and Google Play.
- [`src/components/`](src/components/): homepage sections.
- [`src/pages/privacy.md`](src/pages/privacy.md), [`terms.md`](src/pages/terms.md) and
  [`security.md`](src/pages/security.md): legal pages, written in Markdown. When you change one, update
  its `updated:` date. Email addresses and company details are written out in these files, so update
  them there too if they change.

## Structure

```
public/            Favicons, logo, social image, manifest, robots.txt and Cloudflare _headers
src/
  assets/brand/    Griffin emblem (source and sized variants) and the 21-ray sun
  assets/fonts/    Inter subset with the Kurmanji letters Ş and ş
  components/      Header, Footer, Hero, ProductShowcase, Motto, About, Contact, …
  layouts/         BaseLayout (document, SEO and structured data), LegalLayout (legal pages),
                   NoticeLayout (404)
  lib/             structured-data.ts (JSON-LD) and pages.ts (Markdown versions and llms.txt)
  pages/           Homepage, legal pages, 404, sitemap.xml, llms.txt, llms-full.txt, the Markdown
                   versions ([page].md.ts) and .well-known/security.txt
  scripts/site.ts  Header, mobile menu, section highlighting, scroll reveals, copy button,
                   legal table of contents
  styles/          Font, design tokens and base styles
  site.ts          Site configuration and content
```

## Brand assets

- **Griffin** (`src/assets/brand/griffin-source.png`): the emblem, used in the header, the hero, the
  Google logo (`public/logo.png`) and the social image (`public/og.png`, which also shows the hero
  headline; update it if the headline changes). The site serves it as
  16-colour PNGs at 96–960 px wide (`griffin-*.png`), which for black line art are smaller than WebP or
  AVIF. To regenerate a variant:
  `node -e "require('sharp')('src/assets/brand/griffin-source.png').resize({ width: 480 }).png({ palette: true, colours: 16, dither: 0 }).toFile('src/assets/brand/griffin-480.png')"`
- **Sun** (`src/assets/brand/sun-black-source.png` and `sun-white-source.png`): the 21-ray sun. The
  Kurdish motto section uses the black version on light backgrounds and the white version in dark mode
  (`sun-*-64.png`, cropped to the sun). The favicon and app icons show the white sun on a black tile.

- **Fonts:** everything is set in Inter, self-hosted, except Kurdish phrases. Those use the `kurdish`
  class in `src/styles/global.css`, the same serif italic as hevalo.app:
  `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif`. These are
  fonts already on the visitor's device (Iowan Old Style on Apple devices, Palatino Linotype on
  Windows), so nothing is downloaded. Widths differ between them, so the motto's size leaves room for
  the widest.

  Inter's main file covers basic Latin, which already includes ê, î and û;
  `src/assets/fonts/inter-kurmanji-opsz.woff2` adds Ş and ş, the only Kurmanji letters missing from
  it, for Kurdish words in Inter text, and loads only on pages that use them. It was cut from Fontsource's Inter Latin Extended file
  (OFL, licence alongside it) with fontTools:
  `pyftsubset node_modules/@fontsource-variable/inter/files/inter-latin-ext-opsz-normal.woff2
  --unicodes=U+015E,U+015F --layout-features='*' --flavor=woff2
  --output-file=src/assets/fonts/inter-kurmanji-opsz.woff2`.

The site follows the visitor's light or dark system setting. Colours are tokens in
`src/styles/global.css`; line art is inverted on dark surfaces.

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
- **Header:** switches to the dark palette while it sits over a dark section.
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
- **Markdown versions:** every page is also published as Markdown (`/index.md`, `/privacy.md`,
  `/terms.md`, `/security.md`) and linked from the page with `<link rel="alternate" type="text/markdown">`.
- **llms.txt:** [`/llms.txt`](https://zagrosian.com/llms.txt) is a short overview for language models
  in the [llms.txt](https://llmstxt.org) format, and `/llms-full.txt` has the text of every page in one
  file. Both are built from the same content as the pages ([`src/lib/pages.ts`](src/lib/pages.ts)).
- **Sitemap, robots.txt, web app manifest and security.txt** complete the picture.

The Markdown and text files are marked `noindex`, so search results always show the real pages.

## Browser features

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

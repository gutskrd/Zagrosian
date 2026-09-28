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
| `npm run preview` | Serve the production build locally               |

`npm run preview` does not apply `public/_headers`. To test with Cloudflare's real headers and routing, run
`npx wrangler pages dev dist` after building.

## Editing content

- [`src/site.ts`](src/site.ts): company name, contact email, country, title, description and products.
- [`src/components/`](src/components/): homepage sections.
- [`src/pages/privacy.md`](src/pages/privacy.md), [`terms.md`](src/pages/terms.md) and
  [`security.md`](src/pages/security.md): legal pages, written in Markdown. When you change one, update
  its `updated:` date. The contact email and company details are written out in these files, so update
  them there too if they change.

## Structure

```
public/            Favicons, logo, social image, manifest, robots.txt and Cloudflare _headers
src/
  components/      Header, Footer, Hero, ProductShowcase, Principles, About, Contact, …
  layouts/         BaseLayout (document and SEO), LegalLayout (legal pages), NoticeLayout (404)
  pages/           Homepage, legal pages, 404, sitemap.xml and .well-known/security.txt
  scripts/site.ts  Header state, mobile menu, scroll reveals, legal table of contents
  styles/          Font, design tokens and base styles
  site.ts          Site configuration and content
```

## Deploying to Cloudflare Pages

Connect the repository in Cloudflare Pages with these settings:

| Setting                | Value           |
| ---------------------- | --------------- |
| Framework preset       | Astro           |
| Build command          | `npm run build` |
| Build output directory | `dist`          |

The Node version is pinned by [`.node-version`](.node-version). Add `zagrosian.com` as a custom domain,
then redirect `www.zagrosian.com` to `zagrosian.com` with a Cloudflare redirect rule.

`security.txt` expires 180 days after each build, so redeploy at least twice a year.

## Getting indexed by Google

The site is ready for indexing: every page has a canonical URL, there is a sitemap, and the homepage
carries structured data for the site name and logo. The `*.pages.dev` copy is marked `noindex`, so only
zagrosian.com is indexed. Google still needs to be told the site exists:

1. Deploy the site and check that https://zagrosian.com loads.
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

If you add a third-party script, such as analytics, embeds or Cloudflare Web Analytics, you must
allow it in the Content-Security-Policy and describe it in the privacy policy.

Recommended settings outside the code:

- **Cloudflare:** enable DNSSEC, set SSL/TLS to *Full (strict)*, turn on *Always Use HTTPS*, set the
  minimum TLS version to 1.2, and add CAA records for the certificate authorities you use.
- **Email:** set up `contact@zagrosian.com` with Cloudflare Email Routing and add a DMARC record.
- **Accounts:** use two-factor authentication on Cloudflare, GitHub and your domain registrar, and
  enable the registrar lock.
- **HSTS preload:** once the site has run on HTTPS without issues, you can submit the domain at
  [hstspreload.org](https://hstspreload.org). This is hard to undo: every subdomain must then support
  HTTPS.

Dependabot ([`.github/dependabot.yml`](.github/dependabot.yml)) opens monthly dependency update pull
requests.

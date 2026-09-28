# zagrosian.com

The website of Zagrosian, the technology company behind [Hevalo](https://hevalo.app).

Built with [Astro](https://astro.build) as a fully static site. Pages ship no framework runtime; the only
client-side code is a small inline script for the sticky header, the mobile menu and scroll reveals.

## Commands

Requires Node 22.12 or later.

| Command           | Action                                           |
| ----------------- | ------------------------------------------------ |
| `npm install`     | Install dependencies                             |
| `npm run dev`     | Start the dev server at `http://localhost:4321`  |
| `npm run check`   | Type-check `.astro` and `.ts` files              |
| `npm run build`   | Type-check, then build the site into `dist/`     |
| `npm run preview` | Serve the production build locally               |

## Editing content

Most content lives in [`src/site.ts`](src/site.ts):

- **`contactEmail`**: the official contact address. While it is `null`, the Contact section and all
  contact links are hidden. Set it and they appear in the navigation, the footer and on the homepage.
- **`products`**: the product family. Hevalo is currently the only entry.
- The site title, description and tagline used for SEO and the footer.

Section copy lives in the components under [`src/components/`](src/components/).

## Structure

```
public/            Static files: favicons, social image, robots.txt, Cloudflare _headers
src/
  components/      Header, Footer, Hero, ProductShowcase, Principles, About, Contact, …
  layouts/         BaseLayout (document shell and SEO), NoticeLayout (Privacy, Terms, 404)
  pages/           index, privacy, terms, 404, sitemap.xml
  scripts/site.ts  Header state, mobile menu, scroll reveals
  styles/          Design tokens and base styles
  site.ts          Site configuration and content
```

Inter is self-hosted through Astro's font API (see `astro.config.mjs`), so no third-party font requests
are made.

## Deploying to Cloudflare Pages

Connect the repository in Cloudflare Pages with these settings:

| Setting                | Value           |
| ---------------------- | --------------- |
| Framework preset       | Astro           |
| Build command          | `npm run build` |
| Build output directory | `dist`          |

The Node version is pinned by [`.node-version`](.node-version). Response headers and long-term caching for
fingerprinted assets are set in [`public/_headers`](public/_headers). Pages are built as `/privacy.html`
and served at `/privacy`, which matches Cloudflare Pages' default behaviour. `404.html` is served for
unknown URLs.

After adding the custom domain, redirect `www.zagrosian.com` to `zagrosian.com` with a Cloudflare
redirect rule.

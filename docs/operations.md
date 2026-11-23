# Operations

## Cloudflare

The site runs as a Worker with static assets ([`wrangler.jsonc`](../wrangler.jsonc)). Workers Builds
deploys from GitHub. Configure it under **Workers & Pages → zagrosian → Settings → Build**:

| Setting                       | Value                           |
| ----------------------------- | ------------------------------- |
| Git repository                | `gutskrd/Zagrosian`             |
| Production branch             | The repository's default branch |
| Build command                 | Leave empty; the deploy builds  |
| Deploy command                | `npx wrangler deploy`           |
| Non-production deploy command | `npx wrangler versions upload`  |
| Root directory                | Leave empty                     |

Under **Settings → Domains & Routes**, add `zagrosian.com` and `www.zagrosian.com` as custom
domains. The `*.workers.dev` address and preview URLs send `X-Robots-Tag: noindex`, and can also be
turned off there.

### Recommended dashboard settings

- **SSL/TLS:** Full (strict), Always Use HTTPS, and a minimum TLS version of 1.2.
- **DNS:** turn on DNSSEC, and add CAA records for the certificate authorities in use.
- **Workers Logs:** stay off (`observability.enabled: false`). The privacy policy states that the
  site keeps no server logs. If you turn them on to debug, turn them off again afterwards.
- **AI crawlers:** under **AI Crawl Control** (or **Security → Bots**):
  - AI crawlers must be allowed;
  - _managed robots.txt_ must be off, so `public/robots.txt` is served as written.

### Cost

Requests outside `/_astro/` run the Worker and count toward Workers usage. The free plan includes
100,000 requests a day. Fingerprinted assets in `/_astro/` bypass the Worker
(`run_worker_first`).

## Search engines

The site is ready for indexing:

- canonical URLs on every page;
- `hreflang` alternates;
- a sitemap with `lastmod`;
- structured data.

The remaining steps happen outside the repository:

1. Confirm the latest Workers Build is green and that https://zagrosian.com loads.
2. In [Google Search Console](https://search.google.com/search-console), add a **Domain** property
   for `zagrosian.com`. Verify it with the DNS TXT record Google provides (Cloudflare → DNS →
   Records → Add record, type `TXT`, name `@`).
3. Under **Sitemaps**, submit `https://zagrosian.com/sitemap.xml`.
4. Use **URL inspection** on `https://zagrosian.com/` and choose **Request indexing**.
5. Import the property into [Bing Webmaster Tools](https://www.bing.com/webmasters). Bing's index
   also feeds ChatGPT search and Copilot.

**IndexNow:** [`indexnow.yml`](../.github/workflows/indexnow.yml) submits every URL in the live
sitemap to IndexNow after each successful deploy. Bing, Yandex, Seznam and Naver use it. You can
also run it manually from the Actions tab. The key is `indexNowKey` in `src/site.ts`, and it is
also served at `public/<key>.txt`. Google doesn't support IndexNow and relies on the sitemap.

**Off-site signals:**

- Link to zagrosian.com from hevalo.app and the social profiles.
- Keep the company name and description consistent everywhere.
- Once the company is registered, add it to Wikidata and list that entry in `sameAs`.

## Email and accounts

- **Email:** make sure every address on the domain receives mail, for example through Cloudflare
  Email Routing. Publish SPF, DKIM and DMARC records, so that nobody can send mail as
  zagrosian.com.
- **Accounts:** use two-factor authentication on Cloudflare, GitHub and the domain registrar, and
  turn on the registrar lock.
- **HSTS preload:** the header and redirects are ready. Submitting at
  [hstspreload.org](https://hstspreload.org) is hard to undo, because every subdomain must then
  support HTTPS.

## Dependencies

Dependabot ([`dependabot.yml`](../.github/dependabot.yml)) groups updates into one monthly pull
request for npm and one for GitHub Actions. It skips TypeScript major versions until `astro check`
supports them.

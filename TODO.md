# What still has to be done

What the code can check is checked on every push (see **Testing** in the [README](README.md)):
security headers and policy, accessibility (WCAG 2.2 AA, every page in every language, light and
dark), layout at six screen sizes, search metadata, layout stability, the controls, and Lighthouse.
What is left needs facts only the company has, decisions, people, or access this repository does not
have. Each item says why it matters and where it goes.

## Needs you: facts and decisions

1. **The company's registration.** A company in the EU that offers services online must show its
   registered address, trade register (KvK) number and VAT number on its site (Directive 2000/31/EC,
   article 5; in the Netherlands, Burgerlijk Wetboek 3:15d). The site has none of them yet. Once the
   company is registered, fill them in under `registration` in [`src/site.ts`](src/site.ts); they then
   appear in every footer and in the structured data by themselves. At the same time:
   - set `site.legalName` to the registered name (for example with *B.V.*, if it is one);
   - name the registered company and its address in the privacy policy (who the "controller" is,
     GDPR article 13(1)(a)) and the terms, in all ten languages (`src/content/legal/*/`).

   Have an accountant or lawyer confirm exactly what has to be shown for the company's legal form.

2. **Substance.** The site says what Zagrosian believes and what Hevalo is, but not who is behind it or
   what it has achieved. Visitors who decide whether to trust a company (partners, press, investors,
   people applying for jobs) look for: the founders' names and roles, when it was founded, and real
   numbers for Hevalo (learners, lessons, languages taught, ratings) once there are some. Only facts
   that are true and can be shown. They belong in the About section, and in the structured data
   (`founder`, `foundingDate` in [`src/lib/structured-data.ts`](src/lib/structured-data.ts)).

3. **How much moves.** The homepage has a lot of scroll-driven motion: the logo's journey into the
   story, the sun, the motto, the deer, the water on hover, and sound. Each is smooth on its own, and
   all of it is switched off for visitors who ask for reduced motion, but together they compete for
   attention. Consider keeping the two or three that carry the story and letting the rest go.

4. **Hevalo's apps.** When the iOS and Android apps are out, replace the *Coming soon* note with links
   to the App Store and Google Play ([`ProductShowcase.astro`](src/components/ProductShowcase.astro)),
   and add them to the structured data.

## Needs people

1. **Native speakers.** The interface, homepage and legal pages in Kurmanji, Sorani, Dutch, German,
   Spanish, French, Turkish, Arabic and Persian were translated without a native speaker's review.
   Each translated legal page says the English version applies, but text that reads as machine-made
   costs trust in the very languages Hevalo is about. Have each language read through by a native
   speaker, Kurmanji and Sorani first. New this round: the VAT label in the footer (`footer.vat`),
   shown once a VAT number is filled in.
2. **A lawyer.** The privacy policy, terms and security policy were written carefully but have not
   been reviewed by a lawyer. A review is due once the company is registered (see above), and again
   whenever the site starts to collect more than it does now (analytics, forms, accounts).
3. **Real devices and assistive technology.** The tests run in Chromium on a desktop computer. The
   site has not been tried on an iPhone (Safari), a low-end Android phone, or with VoiceOver, TalkBack
   or NVDA. Spend half an hour with each: the menu, the language menu, the story and the deer,
   and the legal pages.

## Needs access

1. **Search Console and Bing Webmaster Tools.** Verify the domain and submit the sitemap (steps in
   the README under **Getting indexed by Google**), then check that all ten languages are indexed.
2. **Field data.** Lighthouse measures a simulated phone; how fast the site is for real visitors is
   only known from their browsers. Once the site has traffic, the Chrome UX Report shows it in Search
   Console (*Core Web Vitals*) and in [PageSpeed Insights](https://pagespeed.web.dev). Cloudflare's own
   analytics (in the dashboard, without a script on the page) show visits without changing the site
   or its privacy policy.
3. **GitHub Actions.** The checks run on every push once Actions is enabled for the repository. The
   first run shows how fast GitHub's machines score the site. Then consider making *Checks* required
   before merging (**Settings → Branches**).
4. **Cloudflare, DNS and email.** The recommended settings in the README under **Security** (DNSSEC,
   CAA records, SPF, DKIM and DMARC for the published email addresses, two-factor authentication)
   cannot be checked from the repository. HSTS preload: the header is ready; submitting the domain at
   [hstspreload.org](https://hstspreload.org) is a commitment for every subdomain, so decide first.

## Engineering, later

1. **More browsers.** Run the tests in Firefox and WebKit too (Playwright projects in
   [`playwright.config.ts`](playwright.config.ts)). Where a browser lacks scroll-driven animations
   (`animation-timeline`), the deer is shown at rest, already out of its icon; the tests would confirm it.
2. **Screenshots.** Compare screenshots of key states (hero, menu open, story, deer, footer, in light
   and dark, LTR and RTL) on every push, to catch visual changes no other test sees. The reference
   images must be made on the CI machine, as fonts render differently on each system.
3. **Tighter Lighthouse.** Performance under 90 is a warning, not a failure, until a few CI runs show
   how much GitHub's machines vary; then make it a failure.
4. **Development tools.** `npm audit` reports advisories in the copy of undici inside Wrangler, the
   local server for development and tests. It is not part of the site, and clears when Wrangler
   updates it (Dependabot proposes updates monthly).

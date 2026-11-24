# TODO

Everything that can be checked automatically is checked on every push (see [Testing](README.md#testing)).
The items below need a decision, a person or access that the repository doesn't have.

## Decisions

1. **VAT ID.** Zagrosian is registered as an eenmanszaak, and the VAT ID hasn't been issued yet.
   - Once it is, add `vat` to `registration` in [`src/site.ts`](src/site.ts). The footer shows it
     automatically.
   - Have an accountant confirm the required disclosures for this legal form.
   - Keep `site.legalName` in sync with the register.
2. **Company facts.** Partners, press and applicants look for the founders, the founding date and
   real Hevalo numbers (learners, lessons, ratings). Publish only facts that are true and
   verifiable. They belong in the About section and in the structured data (`founder` and
   `foundingDate` in [`src/lib/structured-data.ts`](src/lib/structured-data.ts)).
3. **Amount of motion.** The homepage has a lot of motion: the story, the sun, the deer, the rug,
   the plane and sound. Each piece is smooth and all of it respects reduced motion, but together
   they compete for attention. Consider keeping the two or three that carry the story.
4. **Photography.** The only images are the logo, the sun, the rug and Hevalo. Photographs of the
   Zagros or of Kurdish weaving would add warmth.
   - Use only photographs the company owns, or that are public domain (CC0). No stock photos.
   - Suggested placement: full width between the story and Products, in black and white, as AVIF
     and WebP.
5. **Hevalo's apps.** When the iOS and Android apps ship:
   - replace the _Coming soon_ note with store links
     ([`ProductShowcase.astro`](src/components/home/ProductShowcase.astro));
   - add them to the structured data.
6. **The book, before launch** (see [docs/book.md](docs/book.md)):
   - **Chapters:** export the same set as hevalo.app's download, or state that the whole book is
     free.
   - **License:** confirm the line under the book (`book.licence`), which is CC BY-NC-ND 4.0 in
     plain words.
   - **Author:** page 191 names the author in indexable text. Confirm that, and decide whether
     to add `author` to the structured data.
   - **Reading position:** saving it is deliberately left out. Storing it would need a mention in
     the privacy policy, and possibly consent under the ePrivacy rules.
   - **The PDF** (in Hevalo's repository): add chapter bookmarks, linked contents and the document
     language.
   - **Editions:** each one adds about 45 MB to the repository's history, so launch with a single
     final edition.
   - **Publication date:** set `book.published` in `src/site.ts` to the day the book goes live.

## Needs people

1. **Native speakers.** No native speaker has reviewed the translations. Review every language,
   Kurmanji and Sorani first. The newest strings are `footer.vat`, `share`, all `book.*` strings
   (`book.slider`, `book.zoomHint`, `book.loadFailed`) and `book.chapters`.
2. **A lawyer.** No lawyer has reviewed the privacy policy, terms or security policy.
   - Review them now that the company is registered, and again whenever the site starts collecting
     more data.
   - Confirm that showing the registration details in the footer, while keeping them out of the
     HTML, satisfies the disclosure duties.
3. **Real devices and assistive technology.** CI runs Chromium only. Spend some time with each of
   these:
   - an iPhone on a current iOS, and one on iOS 15 or 16, which uses the Popover API fallback;
   - a low-end Android phone;
   - VoiceOver, TalkBack and NVDA.

   Cover the menus, the story, the deer, the legal pages and, above all, the book: turning pages
   by touch, downloading the PDF, and reading with a screen reader.

## Needs access

1. **Search engines.** Finish the Search Console and Bing setup
   ([docs/operations.md](docs/operations.md#search-engines)), then check that all ten languages
   are indexed.
2. **Field data.** Once there is traffic, real-user performance shows up in Search Console (Core
   Web Vitals) and [PageSpeed Insights](https://pagespeed.web.dev). Cloudflare's dashboard
   analytics need no script on the page.
3. **Default branch.** Rename the default branch to `main`, then update the production branch in
   Workers Builds and make the _Checks_ workflow required before merging.
4. **Cloudflare, DNS and email.** Apply the settings in
   [docs/operations.md](docs/operations.md#recommended-dashboard-settings). They can't be verified
   from the repository.

## Engineering

1. **More browsers.** Add Firefox and WebKit projects to
   [`playwright.config.ts`](playwright.config.ts).
2. **Visual regression.** Screenshot key states (hero, menus, story, deer, footer) in both themes
   and both directions. Generate the reference images on CI, because font rendering differs
   between systems.
3. **Lighthouse.** A performance score below 90 is a warning for now. Make it a failure once a
   few CI runs show how much runner speed varies.

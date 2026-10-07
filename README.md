# zagrosian.com

The website of Zagrosian, the technology company behind [Hevalo](https://hevalo.app).

Built with [Astro](https://astro.build) as a fully static site: no server, no database, no forms, no
cookies and no third-party requests. Available in ten languages: the nine of Hevalo (Kurdish in
Kurmanji and Sorani, English, Dutch, German, Spanish, French, Turkish and Arabic) and Persian.

## Commands

Requires Node 22.12 or later.

| Command           | Action                                           |
| ----------------- | ------------------------------------------------ |
| `npm install`     | Install dependencies                             |
| `npm run dev`     | Start the dev server at `http://localhost:4321`  |
| `npm run check`   | Type-check `.astro` and `.ts` files              |
| `npm run build`   | Type-check, then build the site into `dist/`     |
| `npm test`        | Check the built site (run `npm run build` first; see **Testing**) |
| `npm run preview` | Build, then serve the site at `http://localhost:8787` exactly as Cloudflare does, with the headers from `public/_headers`, clean URLs and the 404 page. Rebuilds when files in `src/` change |
| `npm run deploy`  | Build and deploy to Cloudflare (after `npx wrangler login`); normally Cloudflare deploys from GitHub instead |

## Editing content

- [`src/i18n/messages/`](src/i18n/messages/): all interface and homepage text, one file per language
  (see **Languages** below). The homepage, its Markdown versions and `llms.txt` are built from these
  files, so change text there rather than in the components.
- [`src/site.ts`](src/site.ts): facts that are the same in every language: company name, country,
  Hevalo's name and address, the Kurdish phrases, social profiles, the company's registration and the
  email addresses. The registration (`registration`: registered address, KvK number and VAT number) is
  empty until the company is registered; each detail appears in every footer and in the structured data
  as soon as it is filled in, and nothing is shown until then. Update `site.legalName` to the
  registered name at the same time, and the company details in the legal pages. Each email address
  appears only where it is needed:

  | Address                 | Where it appears                                       |
  | ----------------------- | ------------------------------------------------------ |
  | `contact@zagrosian.com` | Contact section, security policy and `security.txt`   |
  | `press@zagrosian.com`   | Contact section (one line for journalists)             |
  | `privacy@zagrosian.com` | Privacy policy                                         |
  | `legal@zagrosian.com`   | Terms of use                                           |
  | `careers@zagrosian.com` | Privacy policy (job applications); add it to a careers page when you have one |
  | `hello@zagrosian.com`   | Not on the site                                        |

- Social profiles (Instagram [@zagrosian_official](https://www.instagram.com/zagrosian_official/), TikTok
  [@zagrosianofficial](https://www.tiktok.com/@zagrosianofficial)) are listed in `socialProfiles` in
  `src/site.ts`. They appear in the footer and in the homepage structured data (`sameAs`), which helps
  Google connect them to the company. The icons are inline SVGs from
  [Simple Icons](https://simpleicons.org) (CC0), so the site never loads anything from either platform.
  If you add or remove a profile, update the Social media section of the privacy policy too.
- Kurdish phrases (marked `lang="ku"`, so screen readers and search engines treat them as Kurdish):
  *Jiyan bi kurdî xweştire.* ("Life is sweeter in Kurdish", Hevalo's motto) is the large statement at
  the end of the homepage story, in [`Story.astro`](src/components/Story.astro), with a translation
  underneath in every language except Kurmanji (`motto` in the message files). The site closes with
  *Mala we ava.* ("Thank you", literally "may your home prosper", in the footer). The Hevalo section carries a proverb, one of the
  *gotinên pêşiyan* ("sayings of the forebears", as Kurdish proverbs are called), and credits it as
  one: *Dar li ser koka xwe, mirov li ser zimanê xwe şîn dibe.* ("A tree flourishes on its own roots,
  a person in their own language"), *Gotina pêşiyan*. The thanks is an everyday expression, not a
  proverb, so it carries no such credit. All of them are in `kurdish` in
  [`src/site.ts`](src/site.ts), stay in Kurmanji in every language with a translation in the message
  files (`footer.thanks`, `hevalo.proverb`), and use the `kurdish` class, which sets
  them in the same serif italic as hevalo.app (see **Fonts** below). On right-to-left pages they still
  run left to right, but line up on the right with the rest of the page.
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
  assets/brand/    The Zagrosian logos (black, white and lifted: source PNGs, traced SVGs and WebP
                   sizes), the 21-ray sun, the loading animation (zagrosian-loader.gif, served as a lossless WebP), the
                   Hevalo app icon and (deer/) its 3D deer's layers
  assets/fonts/    Inter subset with the Turkish and Kurmanji letters Ğ ğ İ Ş ş
  components/      Header, Footer, Loader, Hero, Story, ProductShowcase, About, Faq, Contact,
                   CommandMenu, LanguagePicker, LanguageSuggestion, ThemeToggle, ThemeSwitch, …
  content/legal/   Legal pages in Markdown, one folder per language
  i18n/            locales.ts (the languages), index.ts (URL helpers) and messages/ (the text)
  layouts/         BaseLayout (document, SEO and structured data), LegalLayout (legal pages),
                   NoticeLayout (404)
  lib/             structured-data.ts (JSON-LD), pages.ts (Markdown versions and llms.txt) and
                   faq.ts (the questions and answers, with their links)
  pages/           English pages at the root, other languages under [lang]/; sitemap.xml, llms.txt,
                   llms-full.txt, the Markdown versions ([page].md.ts) and .well-known/security.txt
  scripts/         site.ts (header, site menu, section highlighting, scroll reveals, copy button,
                   local time, legal page tools), loader.ts (the loading screen),
                   command.ts (quick navigation), motion.ts,
                   story.ts (the homepage story), eyes.ts and deer.ts
                   (Hevalo's eyes, and the 3D deer's blinks and twitches), sound.ts, text.ts,
                   language.ts, theme.ts and theme-init.js
  styles/          Fonts, design tokens and base styles
  site.ts          Facts that are the same in every language
```

## Brand assets

- **Logo:** a Z whose two halves are hands reaching towards each other, in three versions (sources
  in `src/assets/brand/zagrosian-logo-*-source.png`):
  - **Black and white** (`dark` and `light`), the logo everywhere: the header and site menu, the
    favicons, the app icons, the Google logo (`public/logo.png`) and the social
    images. They are the same Z, the white one drawn a touch finer, as white on black reads heavier.
    Each is traced to a vector (6× upscale, lightly blurred, threshold 50%, potrace, then SVGO:
    about 2 KB each), `zagrosian-logo-dark.svg` and `zagrosian-logo-light.svg`, filled with
    `currentColor`. [`Logo.astro`](src/components/Logo.astro) inlines them: the black one in the
    light theme and the white one in the dark theme.
    - `favicon.svg` holds both and switches with the browser's colour scheme (through a `<style>`,
      which its own header rule in `public/_headers` allows); `favicon-96.png` (black) and
      `favicon-96-dark.png` (white) do the same for browsers without SVG icons, and `favicon.ico`
      (16, 32 and 48 px) is black.
    - The app icons (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) are the black logo on
      white, well inside the area phones may round or crop.
    - The social images (`public/og.png` in English and `public/og/<language>.png`) show the white
      logo beside the hero headline in that language; update them if the headline changes.
  - **Lifted**: the hands set in a block of clear glass, in 3D, in the homepage hero
    ([`LiftedLogo.astro`](src/components/LiftedLogo.astro)). It is drawn rather
    than shown as an image, so it is sharp at any size: the light shapes are traced from the lifted
    logo (the light regions inside its frame, 6× upscale, lightly blurred, potrace, SVGO:
    `zagrosian-logo-lifted.svg`, 2 KB; the dark parts are the tile less those), and the block is
    built in CSS 3D: a back face that tints the glass and casts its shadow, twenty thin layers that
    make its edge, the logo floating between the faces within a thin frame as in the original, and
    a front face that only catches the light (a bevel, a glare and a streak), so the logo stays
    crisp. It rests turned a little, so its depth shows, and in the hero it turns further towards
    the pointer over two soft lights that show through it. On the light page the logo's dark parts
    and frame are smoked glass and the rest clear; on the dark page (and the always-dark opening
    screen) its light parts are frosted and the rest clear.
    On the homepage it travels into the story under the hero (see Motion). The glass does not blur
    what is behind it (`backdrop-filter`): the lights behind it are soft already, and a backdrop
    blur is costly to redraw while the block moves; a faint haze inside the glass on the dark page
    stands in for it.

  If a logo changes, trace the new one the same way and regenerate the icons and social images.
- **Sun** (`src/assets/brand/sun-black-source.png` and `sun-white-source.png`): the 21-ray sun. It
  is drawn from its measured geometry ([`src/lib/sun.ts`](src/lib/sun.ts): 21 straight rays, the
  gaps between them at 51.2% of the rays' length), so it is sharp at any size: in the colour of the
  text above the Kurdish motto ([`Sun.astro`](src/components/Sun.astro)), where it rises in the
  homepage story.
- **Hevalo icon** (`src/assets/brand/hevalo-source.png` and `hevalo-christmas-source.png`): Hevalo's
  app icon, the deer, in the hero's *coming soon* notice and, in 3D, in the products section. From
  1 December to 6 January the site shows the Christmas version instead: `theme-init.js` sets
  `data-season="christmas"` before the first paint, and only the icon in season is downloaded. The
  served WebPs (`hevalo-96/192/288.webp`, `hevalo-christmas-96/192/288.webp`) are cropped to the same
  360 px box at (70, 64) in the 500 px sources, so the two line up; the Christmas deer's scarf hangs
  below it. Near-invisible pixels (alpha ≤ 8) are made fully transparent, and the WebPs are quality 80.
  The deer's eyes follow the pointer ([`eyes.ts`](src/scripts/eyes.ts)): the mouse, or on a touch
  screen the finger, while it touches and for a moment after. Every served image is made from
  `hevalo-eyeless-source.png` and `hevalo-christmas-eyeless-source.png`, the sources with the pupils
  painted out (filled from the white around them), and the pupils, with their highlights, are drawn
  over the images ([`HevaloEyes.astro`](src/components/HevaloEyes.astro)) at the places they have in
  the artwork; each moves within the white of its eye and returns to the artwork's pose, turned in,
  when there is nothing to follow. Both seasons, the icon and the 3D deer share the same eyes. Not
  with *reduce motion*; in forced colours the pupils keep their colour.
  - **3D deer** ([`HevaloDeer.astro`](src/components/HevaloDeer.astro)): for the products section,
    [`scripts/deer-layers.cjs`](scripts/deer-layers.cjs) takes the eyeless icon apart into layers
    (`src/assets/brand/deer/`): the shade the deer casts on the page, the neck (whole under the chin
    and carried on far below the tile's edge, so the hole never shows its end however deep the
    deer is), the antlers, each ear,
    the head (with the Christmas scarf), the nose, and the Christmas snowflakes (the purple itself is drawn in CSS). Each layer is the deer's own pixels,
    unmixed from the purple at their edges (the purple is a fitted gradient, so no trace of the deer
    is left on it); the cuts follow the artwork's own outlines (the jaw takes in the shaded
    underside of the chin, the nose is solid inside its outline with a soft edge in its own colour),
    and the parts behind the head reach a little under it, smoothly, in their own colour, so nothing
    opens up when they move apart. The square's outline is measured on the source (its sides are at
    13.7 and 346.1 of 360, not quite where they look). Laid back together the layers give the icon
    again. WebP at 288 and 576 px (the soft shade at 144), loaded lazily. Run
    `node scripts/deer-layers.cjs` after changing a source; it prints each layer's box, which
    `HevaloDeer.astro` positions it by.

- **Fonts:** Latin text is set in Inter and Arabic script (Arabic, Sorani and Persian) in
  [Vazirmatn](https://github.com/rastikerdar/vazirmatn), both self-hosted variable fonts under the OFL.
  Vazirmatn was designed for Persian, matches Latin sans-serifs like Inter and also covers Arabic and
  the Sorani letters (ڕ ڵ ۆ ێ ە). The browser downloads it only when Arabic script is on screen: on
  Arabic, Sorani and Persian pages, and elsewhere when the visitor reaches for the language menu,
  which lists those three languages in their own script. Kurdish phrases use the `kurdish`
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
  is an external file because the Content-Security-Policy forbids inline scripts. When motion is
  welcome, it also decides whether the loading screen shows (`data-loading`) and makes room before
  the first paint for the homepage story (`data-story`), so nothing shifts when it starts.
- [`src/scripts/theme.ts`](src/scripts/theme.ts) runs the controls. Where the browser supports view
  transitions, the new theme spreads out in a circle from the control that was used; with *reduce
  motion* it changes instantly. It also updates the browser toolbar colour (`theme-color`) and
  follows system changes while *System* is selected.
- Colours are tokens in `src/styles/global.css`, with the dark values under
  `:root[data-theme='dark']`. Without JavaScript the site stays light and the controls are hidden.

## Motion

Animation is handled by [`src/scripts/motion.ts`](src/scripts/motion.ts) with no dependencies, using
the Web Animations API, IntersectionObserver and a single requestAnimationFrame loop:

- **Long pages:** the homepage's last sections (About, FAQ, Contact) and every page's footer are
  not laid out or drawn until the reader nears them (`content-visibility: auto`), so the first
  screen is ready sooner; their text is in the page all the while, for search engines, screen
  readers and find-in-page.
- **Loading screen** ([`Loader.astro`](src/components/Loader.astro),
  [`loader.ts`](src/scripts/loader.ts)): when a visit starts, or the page is reloaded, the page's
  own colour covers it while Zagrosian's Z plays (`zagrosian-loader.gif`): it squeezes into a
  rounded square and back, then its hands melt into the 21-ray Kurdish sun, which holds, and come
  back. It plays once through, about three seconds (longer only while the page is still loading),
  then fades away; a click, a tap, a key or a scroll lets the visitor straight in. On the dark
  theme it is inverted, white on black; either way its ground is blended into the page's colour,
  so no square shows round it. Not between pages of the site (they open at once), not with
  *reduce motion*, and never without JavaScript; should the script not start, it lifts by itself
  after eight seconds. It never holds the page up: its first frame, the Z (4 kB), shows at once,
  and the animation is fetched once the page itself has loaded, taking over from the first frame
  where it stands (it is cached for the pages after); on a slow connection the screen lifts four
  seconds after the page started, at the latest. The page loads and draws
  underneath all the while, so it costs the page nothing in search engines' measures of speed.
- **Hero:** the headline rises line by line from behind masks on load, and the lifted logo rises
  into place and comes into focus. Each of these lets go when it ends, so nothing stays animated
  (and composited) behind the story. Coming from another page of the site, the page slides in as a
  whole, and that is its entrance: the hero is already in place (`data-arrival`, set by
  `theme-init.js` when the page is revealed with a view transition).
- **The story** ([`Story.astro`](src/components/Story.astro), [`story.ts`](src/scripts/story.ts)):
  a walkthrough under the hero, pinned to the screen for four and a half screens of scrolling, in
  four chapters, all in glass and in 3D. It follows what award-winning scroll stories do (Apple's
  product pages, the Lando Norris site that was Awwwards' Site of the Year 2025): a stage pinned in
  place while the scroll moves time on inside it, one idea per scene, text that rises with the
  visuals, and only sizes, transforms, opacity and clip paths moving.
  1. **The values.** As the hero scrolls away, the glass logo stays on the screen and settles
     beside Zagrosian's three values (*Simplicity. Privacy. Clarity.*, `story.values` in the message
     files). Each flips up in 3D from behind a mask in turn, the newest lit and the others dimmed,
     and the logo turns a notch with each; then all three are lit together.
  2. **The dive.** The values lift away; the logo comes to the middle, faces the reader and the
     camera flies into the glass: the front pane slides past and fades, and the block's layers
     spread apart in perspective as the camera nears the logo's ink (the smoked dark parts on the
     light page, the frosted light parts on the dark page). The graphics card does the growing:
     from when it turns to face the reader, the logo is laid out once, at its size facing the
     reader (and the sun once, at its largest), and only scaled, with its perspective shortened to
     match, so its layout never changes as the camera flies in and nothing on the page shifts (a
     page whose layout moves as it scrolls is marked down by search engines' Core Web Vitals).
     The graphics card keeps its drawing while it moves (`will-change: transform`) and draws it
     again, sharp, only when its size has grown or shrunk by half a doubling (story.ts lets go of
     `will-change` for one frame), so it is never drawn at more than 1.4 times the size it is seen
     at, or less, scrolling down or up. (Drawn once and scaled thirty times, it had to be redrawn
     at a size no graphics memory holds when the page scrolled back up into it, and parts of it
     went missing.) Before that, turned in 3D, it is laid out at the size it is seen at, as a
     drawing in perspective is drawn at its layout's size. Face on, its edge layers are not drawn. Where
     it flies in was found with a distance transform of the logo's shapes: the point deepest inside
     the ink.
  3. **The sun.** The ink becomes a scene in the other theme's colours (`.story__scene`). The
     Kurdish sun rises as a thick piece of glass ([`GlassSun.astro`](src/components/GlassSun.astro):
     a back face and a bevelled front with a glint, each cut to the sun's outline with
     `clip-path`), tumbling and catching the light, with a soft glow behind it; it
     comes to rest facing the reader above the motto, which rises word by word with its
     translation. The header switches to the scene's colours while the scene is behind it
     (`data-inverse`, global.css).
  4. **The iris.** The scene closes into the sun like an iris (a `clip-path` circle), and leaves the
     sun and the motto in the page's own colours: inside the circle the scene's motto, outside it
     the page's, in exactly the same place. Then the stage lets go and they scroll on.
  A line along the foot of the stage shows how far along the story is. Scrolling back plays it all
  backwards, on a phone as with a mouse, and every point looks the same whichever way it was
  reached. On a phone the stage is as tall as the screen without the address bar (`100lvh`), so
  its colours reach the bottom edge when the bar slides away, while its content keeps to the part
  the bar never covers (`100svh`), so nothing moves when the bar comes back. Everything is a
  function of the scroll position: the page
  is measured on load and resize only, the logo travels in a layer fixed to the screen
  (`[data-journey-layer]`, Hero.astro) whose original stays in the hero for screen readers, and
  the copies used for effects are hidden from assistive technology. `theme-init.js` makes room
  for the story before the first paint (`data-story`). Without JavaScript, with *reduce motion* and
  in print, the story is a plain section: the values as a heading, then the sun and the motto.
  Its text is in the HTML either way, so search engines and AI crawlers read it.
- **Headings:** [`SplitText`](src/components/SplitText.astro) splits a heading into words at build
  time. `effect="rise"` makes the words rise one after another as it enters the viewport;
  `effect="highlight"` brightens them as the reader scrolls past (the About statement).
- **Sections:** blocks marked `data-reveal` fade up; elements with the `rule` class draw their top
  hairline across. Entrances (these, the rising headings and lines) only play for
  what comes up from below: opened part-way down the page (a link to Contact, a reload) and
  scrolled back up, everything above is simply there.
- **Footer:** the Zagrosian wordmark stands up out of its baseline in 3D as the footer appears
  (`data-rise`).
- **Products:** Hevalo's app icon is a hole in the page, and the deer comes out of it from behind
  the page. The page is cut in the icon's shape (its cut edge throws a soft shade inside), and
  through it is the purple space behind the page. As the section scrolls into view, the deer comes
  up from deep in that space, small and hazed with its purple, its ears laid back, and pushes
  forward through the hole until its head is out in front of the page: there its ears spring up,
  past where they rest, and settle; it casts its shade on the page around the hole; and it comes
  to rest as the icon has it, its neck going back into the hole. Scrolling back takes it back in.
  Behind the page it is clipped by the hole, in front it is not: there are two copies of it, one
  in the hole and one in front, and each takes over from the other at the moment the deer crosses
  the page (at 70% of its size, 35% of the way), when every part is well inside the hole (checked
  against the artwork, in both seasons), so the swap cannot be seen (the two copies match pixel
  for pixel there) and nothing is ever cut by the hole's edge. The purple far behind slides as the
  page scrolls, too. A dozen layers, each only scaled, moved, turned or faded on the graphics card
  in step with the scroll (no script, no 3D scene, no masks). The deer is alive but never busy
  ([`deer.ts`](src/scripts/deer.ts)): on screen it blinks every few seconds and now and then
  twitches an ear or sniffs; when it is first all the way out it pricks up its ears, and a tap or
  click gets all of it at once. Each is a short CSS animation
  (`transform` only) started by an attribute and removed when it is over, so nothing runs in
  between, off screen or in a background tab. Under the name, the facts at a glance (dialects,
  website, iOS and Android coming soon), as the FAQ and the hero's notice say them.
- **Scroll-driven CSS:** where the browser runs scroll-linked animations itself (CSS
  `animation-timeline`: Chrome, Edge and Safari 26), the deer coming out of the Hevalo hole, the
  footer wordmark and the legal pages' reading bar are left to it, so they move on the graphics
  card in step with the scroll; elsewhere a script does the same (motion.ts), and the deer is
  simply out of its hole. They are written as separate properties, because the build's minifier would
  otherwise fold the timeline into the `animation` shorthand, which browsers reject.
- **Pointer depth:** with a mouse, the travelling logo leans towards the pointer in 3D. Touch
  screens and *reduce motion* get none of this.
- **Legal pages:** a reading-progress bar and the current section highlighted in the contents.

Rules the code follows:

- Only `transform`, `opacity` and colour change, so animations stay smooth on the compositor.
- Everything is visible without JavaScript, and nothing moves when the visitor has turned on
  *reduce motion*.
- No HTML is generated in the browser and no `style` attributes are written (styles are set through
  the CSSOM, and new elements are built with the DOM API), so the Content-Security-Policy and Trusted
  Types rules in `public/_headers` stay strict.
- Split headings keep their full text as their accessible name.

## The studio experience

The site has a few touches of a design studio's: sound, rolling labels and cinematic page changes.
The pointer stays the visitor's own (no custom cursor, nothing that moves away from it), so the site
is as easy to use as it is to look at. All of it is original: the sounds are synthesised in the
browser, and nothing is borrowed from another site. Every piece steps back for visitors who prefer
reduced motion, and the site works fully without it.

- **Sound** ([`sound.ts`](src/scripts/sound.ts), [`sound-engine.ts`](src/scripts/sound-engine.ts)):
  off until the visitor turns it on, from the header (the level meter), the site menu, quick
  navigation, or a small card offered once to first-time visitors. Everything is synthesised with the Web Audio API, so no
  audio files are downloaded and the Content-Security-Policy needs no media sources; the synthesiser
  itself (5 KB) is downloaded only once sound is on:
  - an ambient score: a slow chord in D Phrygian (the scale of the Kurdish maqam Kurd) that breathes,
    soft wind, and now and then a bell, in a generated reverb;
  - interface sounds: a tick when the pointer or keyboard reaches a control, a tap on a click, air
    when a menu opens or closes, and bells when sound is switched on or off.

  It is the same on every page: the homepage, the legal pages and the 404 page share the header,
  the card and the script. The choice is remembered. Browsers only allow audio after an interaction,
  so on the next page the score swells back in as the page opens where the browser carries that
  permission over (Chrome and Edge, including pages it prepared in advance), and otherwise with the
  first click, tap or key press. Following a link, the score fades out rather than being cut off. It
  pauses while the tab is hidden.
- **Header and menu** ([`Header.astro`](src/components/Header.astro),
  [`MenuButton.astro`](src/components/MenuButton.astro), [`SiteMenu.astro`](src/components/SiteMenu.astro)):
  the header is the same at every size: the logo, then Visit Hevalo (from 768px), quick navigation
  (from 1024px), the world icon for languages ([`Globe.astro`](src/components/Globe.astro), whose
  meridians spin on hover), sound, theme, and the menu button: two dots on their own, which flip across
  to each other's side on hover (the label rolls with them) and stretch into an X when the menu opens. The menu is a full-screen panel, in the page's own colours (light or dark as the theme is), that drops
  in like a curtain; its links, set very large, rise one after another from behind masks (the others
  dim under the pointer, and the section in view is marked with a dot), followed by Visit Hevalo,
  contact, social media, every language, sound, the legal pages and the time at headquarters. It is a
  native popover: it opens, closes on Escape and returns focus without JavaScript; the page behind
  does not scroll while it is open.
- **Buttons** ([`Cta.astro`](src/components/Cta.astro), [`RollText.astro`](src/components/RollText.astro)):
  under a mouse their colour fills in from the middle, labels roll letter by letter (Arabic script,
  whose letters join, rolls as one piece) and arrows slide out as a copy slides in. The menu's links
  roll too.
- **Text** ([`text.ts`](src/scripts/text.ts)): paragraphs marked `data-lines` rise line by line from
  behind masks, then are put back as they were. Section labels are small monospace capitals.
  Headlines are set large and fairly light.
- **Scrolling** is the browser's own, so the page follows the wheel, the trackpad and the finger at
  once, with no delay. Links to a section glide there (`scroll-behavior: smooth`, not with *reduce
  motion*) and stop below the header (`scroll-padding-top`). The page holds still while a dialog or
  the site menu is open.
- **Page changes:** in browsers with cross-document view transitions, the next page rises over the
  last like a card laid on top while the old one sinks back and darkens. Every page shares the
  header, footer, menu, theme and sound, so they behave the same everywhere.

## Readable by machines

Besides the pages themselves, the site describes itself in formats that search engines, AI assistants
and other tools read directly:

- **Structured data:** every page carries a schema.org JSON-LD graph
  ([`src/lib/structured-data.ts`](src/lib/structured-data.ts)): the WebSite, the Organization (logo,
  contact points, social profiles, the Hevalo brand), Hevalo itself as an application
  (`SoftwareApplication`, educational, in Kurdish; where it runs is left out until the native apps
  are out) and the page itself, with breadcrumbs and a
  last-modified date on the legal pages, and the homepage's questions and answers (`FAQPage`). Nodes
  refer to each other by `@id`, so they form one description of the company. (Google stopped showing
  FAQ rich results in May 2026; the markup stays because it is accurate and other tools read it.)
- **Questions and answers** ([`Faq.astro`](src/components/Faq.astro), `faq` in the message files):
  six short questions before Contact, each opening to its answer (native `details`: keyboard and
  screen-reader ready, working without JavaScript, and find-in-page opens the answer it finds). The
  answer slides open to its natural height where the browser can animate it (`::details-content`
  with `interpolate-size`), and the plus beside the question turns into a minus. A line after the
  list says where to ask anything else (`faq.more`). The answers are in the page either way, so
  search engines and AI assistants read them; every answer says only what the rest of the site
  already says. They are in the Markdown version and the structured data too, from one list
  ([`src/lib/faq.ts`](src/lib/faq.ts)).
- **Search previews:** indexable pages allow large image previews and full-length snippets
  (`<meta name="robots" content="… max-image-preview:large, max-snippet:-1 …">`).
- **Markdown versions:** every page, in every language, is also published as Markdown (`/index.md`,
  `/privacy.md`, `/de/index.md`, `/de/privacy.md`, …) and linked from the page with
  `<link rel="alternate" type="text/markdown">`.
- **llms.txt:** [`/llms.txt`](https://zagrosian.com/llms.txt) is a short overview for language models
  in the [llms.txt](https://llmstxt.org) format, with links to every language, and `/llms-full.txt` has
  the text of every English page in one file. Both are built from the same content as the pages
  ([`src/lib/pages.ts`](src/lib/pages.ts)).
- **Sitemap, robots.txt, web app manifest and security.txt** complete the picture. `robots.txt`
  welcomes every crawler, AI assistants included, and points them to `llms.txt`, `llms-full.txt` and
  the Markdown versions.
- **Clean text in the HTML:** crawlers that read the raw HTML (most AI crawlers do) get every piece of
  text once and in order. Rolling button labels draw their letters with CSS from `data-char`
  attributes instead of repeating the label, and the headline's lines are separated by a real
  space.

The Markdown and text files are marked `noindex`, so search results always show the real pages.

**Getting found.** The site does what a site can do on its own: fast, accessible pages in ten
languages with `hreflang`, clean text and headings, structured data and a sitemap. (Google needs no
special markup for its AI Overviews: pages that are indexed and shown with snippets are eligible.
Few AI crawlers read `llms.txt` yet, so it is a courtesy, not a requirement.) What decides where it
ranks happens off the site, and is up to Zagrosian:

- Verify the domain in [Google Search Console](https://search.google.com/search-console) and
  [Bing Webmaster Tools](https://www.bing.com/webmasters) and submit `https://zagrosian.com/sitemap.xml`
  (Bing's index also feeds ChatGPT search and other assistants).
- After each deploy, run `npm run indexnow` ([`scripts/indexnow.mjs`](scripts/indexnow.mjs)): it
  tells search engines that support [IndexNow](https://www.indexnow.org) (Bing, Yandex, Seznam,
  Naver) about every page in the live sitemap, so they crawl them soon. The key is in `src/site.ts`
  and `public/<key>.txt`. Google does not use IndexNow; it reads the sitemap, whose dates come from
  each legal page's `updated` field and, for the homepage, from `updated` in `src/site.ts`: change
  that date when the homepage's text changes.
- Link to zagrosian.com from hevalo.app and from the Instagram and TikTok profiles, and keep the
  company's name and description the same everywhere.
- Once the company is registered, add it to [Wikidata](https://www.wikidata.org) with its official
  details and the same profiles, and add that entry to `sameAs` in `src/site.ts`: it helps search
  engines and AI assistants recognise Zagrosian as one entity.
- Mentions and links from Kurdish and Dutch press, app directories and partners do more for ranking
  than anything on the page.

**AI crawlers and Cloudflare:** Cloudflare can block AI crawlers, or rewrite `robots.txt` to forbid
them, from its dashboard, and may do so by default on new domains. For the site to be read
by AI assistants, check in the Cloudflare dashboard for zagrosian.com, under **AI Crawl Control** (or
**Security → Bots**), that AI crawlers are allowed and that **managed robots.txt** is off, so the file
above is served as written.

## Languages

The site is in the nine languages of Hevalo and Persian, listed in
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
| Persian (Farsi)     | `fa`  | `/fa`           | right to left |

Every page exists in every language at the same path under the language's prefix (`/privacy`,
`/de/privacy`, `/ar/privacy`), each with its own 404 page. The language is read from the address, so
pages are fully static and every language can be indexed.

- **Text:** [`src/i18n/messages/en.ts`](src/i18n/messages/en.ts) defines every string; each other
  language file has the same shape, so a missing or extra string is a type error at build time.
  The Kurdish and Arabic translations use the same words as Hevalo's own interface where they overlap.
  Brand and product names stay in Latin script.
- **Choosing a language:** the world icon in the header opens a menu with every language, each
  written in that language (a native popover, so it works with keyboard and screen readers and needs
  no script to open). Every language is also listed in the site menu. Visitors whose browser prefers another
  available language see a small suggestion to switch, written in that language; it never redirects.
  Once they choose or dismiss it, it does not appear again (`language-chosen` in `localStorage`, which
  the privacy policy mentions).
- **Right to left:** Arabic, Sorani and Persian pages set `dir="rtl"`. Layout uses logical CSS properties, so
  it mirrors by itself; arrows flip, and Arabic script gets no letter-spacing and taller lines. Latin
  text inside them (brand names, email addresses, the Kurmanji motto) keeps its own direction and
  spacing.
- **Persian:** written in formal Persian with Persian letters (ی، ک), zero-width non-joiners where
  Persian needs them (می‌کنیم، داده‌ها) and Persian digits. Dates use the Solar Hijri calendar, with the
  Gregorian date of the English original in brackets on legal pages. Browsers set to Dari (`prs`) are
  offered the Persian pages.
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

- **Quick navigation:** Ctrl K (⌘K on Apple devices), the `/` key or the round search button in the header
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
- **Page transitions:** browsers that support cross-document view transitions lay the next page over
  the last (see *The studio experience*), with the header staying in place.
- **Accessibility preferences:** besides light and dark mode and *reduce motion*, the site responds to
  *increase contrast* (darker secondary text and lines), to *reduce transparency* (a solid header and
  a plain dimmed backdrop behind quick navigation) and to Windows' forced colours (high contrast),
  where buttons get outlines and drawn marks use the system text colour.

## Testing

[`tests/`](tests/) checks the built site in Chromium with [Playwright](https://playwright.dev), served
as Cloudflare serves it, with the headers from `public/_headers`
([`tests/wrangler.jsonc`](tests/wrangler.jsonc)):

| File                    | What it checks |
| ----------------------- | -------------- |
| `security.spec.ts`      | The security headers, and that no page in any language breaks the Content-Security-Policy or logs an error while it is scrolled through |
| `accessibility.spec.ts` | Every page and 404 page in every language, light and dark, on a computer and a phone, with [axe](https://github.com/dequelabs/axe-core) against WCAG 2.2 AA and its best practices |
| `layout.spec.ts`        | Every page at six widths from 320 to 1920 pixels: nothing runs off the screen or is cut off, and everything you tap is at least 24 by 24 pixels |
| `seo.spec.ts`           | Every built page's title, description, canonical URL, alternate languages, main heading and structured data; the 404 pages are kept out of search; the sitemap lists every page |
| `stability.spec.ts`     | No layout shift while the homepage loads, or while it is scrolled down and up, left to right and right to left |
| `interactions.spec.ts`  | The language menu, the language suggestion, the site menu on a phone and the theme |
| `menu.spec.ts`          | The site menu is in the page's colours in both themes, also when opened over the story |
| `loader.spec.ts`        | When the loading screen shows, that it lifts, and that it never shows with reduced motion |
| `deer.spec.ts`          | The deer climbs out of its icon as it scrolls into view, and back in |

```sh
npm run build
npm test                               # everything (about 4 minutes)
npx playwright test tests/seo.spec.ts  # one file
```

The first time, install the browser with `npx playwright install chromium`. `npm test` starts the
server itself, on port 8788.

On every push, GitHub Actions runs the same tests, and Lighthouse on five pages
([`.github/workflows/checks.yml`](.github/workflows/checks.yml)). Accessibility, best practices and
SEO must score 100 ([`lighthouserc.json`](lighthouserc.json)); a performance score under 90 is reported
as a warning, as the machines GitHub runs it on vary in speed. When a run fails, its report is kept with
the run (**Actions → the run → Artifacts**).

What is still to be done, and what needs people or decisions rather than code, is in
[`TODO.md`](TODO.md).

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

**Cost:** the site is served entirely as static files by Cloudflare, with no Worker script, so
requests do not count against Workers usage, and hashed assets (`/_astro/*`) are cached by browsers
for a year.

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
requests, for the site's packages and for the actions the checks use. It skips TypeScript 7, which
`astro check` does not support yet.

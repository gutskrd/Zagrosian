# Architecture

## Rendering

Every page is prerendered to a static HTML file (`build.format: 'file'`, no trailing slashes). The
default locale is served at the root and the others under `/[lang]`. Each page type has a view in
`src/views/`, which both route files render.

The Content-Security-Policy allows no inline code, and that shapes the build
([`astro.config.mjs`](../astro.config.mjs)):

- Styles and scripts are always emitted as files (`inlineStylesheets: 'never'`,
  `assetsInlineLimit: 0`).
- The whole site shares a single stylesheet (`cssCodeSplit: false`). It is one request, cached
  across pages.
- [`theme-init.js`](../src/scripts/theme-init.js) is a render-blocking classic script in `<head>`.
  It is imported with `?url` and minified by a small Vite plugin. Before first paint it:
  - applies the stored theme;
  - selects the seasonal icon;
  - reserves space for the homepage story;
  - holds the homepage entrance until fonts and hero images are ready (at most 2.5 s).
- Shader sources are tagged `/* glsl */`, and their comments are stripped at build time.

## Client scripts

[`src/scripts/main.ts`](../src/scripts/main.ts) is the only entry point and runs on every page.
Each feature looks for its own elements and does nothing when they are absent. The book reader is
a separate entry, loaded only on `/book`.

Heavy features load on demand:

| Chunk          | Loaded when                                                        |
| -------------- | ------------------------------------------------------------------ |
| `rug/scene`    | The rug is within one viewport and scrolling has paused for 150 ms |
| `rug/plane`    | Together with the rug                                              |
| `sound/engine` | The visitor turns sound on                                         |

Under the CSP, scripts never build HTML from strings. Elements are created with the DOM API and
styles are set through the CSSOM (`element.style`). Trusted Types are enforced with no policies
(`trusted-types 'none'`), so no sink that parses HTML can be used.

## Motion

[`motion/index.ts`](../src/scripts/motion/index.ts) is a small, dependency-free runtime. These rules
apply throughout:

- Only `transform`, `opacity` and color animate, so work stays on the compositor. The one
  exception is a book leaf, which changes its stacking order once, while it stands on edge.
- One-off entrances use the Web Animations API.
- All scroll-linked effects share one `requestAnimationFrame` loop. Every effect reads layout
  first, then writes, and runs only while its element is near the viewport.
- Where CSS scroll-driven animations are supported (`animation-timeline`), the CSS version runs
  instead of the script. These are written as longhand properties, because the minifier would
  otherwise fold the timeline into the `animation` shorthand, which browsers reject.
- Entrances play only for content entering from below. Content reached by scrolling up, or after a
  deep link, is shown as is.
- Nothing changes size while scrolling, so the page never shifts under the reader. On mobile,
  layout uses `svh` and `clientHeight` rather than the dynamic toolbar height.
- With `prefers-reduced-motion`, nothing moves. Without JavaScript, everything is visible and
  static.

### The homepage story

[`motion/story.ts`](../src/scripts/motion/story.ts) drives a pinned stage over roughly four and a
half viewport heights of scrolling. It has four acts:

1. **Values:** the glass logo settles beside them.
2. **Dive:** the camera flies into the logo.
3. **Sun:** a glass sun rises over the Kurdish motto.
4. **Iris:** the scene closes into the sun.

Every frame is a pure function of scroll position, so scrolling back replays the story exactly in
reverse.

- **The traveling logo** is a clone in a fixed layer. The original stays in the hero for assistive
  technology.
- **Sharpness without relayout:** facing the viewer, the logo is laid out once at its largest size
  and only scaled. A layer is re-rasterized when its scale crosses a √2 step, so it is never drawn
  at more than 1.41× or less than 1/1.41× its displayed size.
- **Cheap redraws:** soft shadows and shading are pre-rendered images rather than blurred box
  shadows, because a blur is recomputed at every new size.

### Interactive pieces

- **Rug** ([`rug/scene.ts`](../src/scripts/rug/scene.ts), [`rug/cloth.ts`](../src/scripts/rug/cloth.ts))
  - WebGL 2 cloth: a particle grid solved with position-based dynamics in fixed 60 Hz steps and
    interpolated for display, so it moves evenly at 90 and 120 Hz too.
  - On touch, a long press or a sideways start grabs the rug, while a vertical swipe still scrolls
    the page.
  - A button lifts the corner for keyboard and screen-reader users.
  - Without WebGL, a flat image is shown.
- **Paper plane** ([`rug/plane.ts`](../src/scripts/rug/plane.ts))
  - A 2D canvas drawing, folded along real creases ([`rug/plane-folds.ts`](../src/scripts/rug/plane-folds.ts)).
    The proverb sheet's creases come from the same geometry.
  - It stays under the rug until the rug has been lifted. It then flies with the scroll and lands
    on the sheet, unfolding into it.
- **Hevalo's deer** ([`HevaloDeer.astro`](../src/components/home/HevaloDeer.astro))
  - Layered images that scroll-driven CSS moves out of the app icon.
  - Idle blinks and twitches are short CSS animations, toggled by data attributes
    ([`hevalo/deer.ts`](../src/scripts/hevalo/deer.ts)). The eyes follow the pointer.
- **Sound** ([`sound/`](../src/scripts/sound/))
  - Opt-in, and synthesized with Web Audio, so no audio files are downloaded.
  - Autoplay rules allow audio only after a user gesture. Chrome and Edge carry activation across
    same-site navigations, so the score resumes on load there. Other browsers resume on the first
    interaction.
- **Command menu** (Ctrl/⌘ K or `/`)
  - Its entries are rendered at build time, and the script only filters them.
  - Follows the ARIA combobox pattern and matches English names in every locale.

## Browser support

The code targets current browsers, plus Safari 15+ (iPhones and iPads that stay on iOS 15 or 16)
and Chrome 91+. Neither needs syntax lowering, but several features need a fallback:

- **Popover API** (Safari < 17, Chrome < 114):
  - [`utils/popover.ts`](../src/scripts/utils/popover.ts) emulates what the menus need: toggling,
    light dismiss, Escape and focus return.
  - A PostCSS plugin ([`postcss.config.mjs`](../postcss.config.mjs)) gives every `:popover-open`
    rule a twin that uses the fallback's class, scoped to `[data-popover-fallback]`.
  - While a fallback popover is open, the header's `backdrop-filter` is removed. A filtered
    ancestor would otherwise become the containing block of the fixed menu.
  - `menu.spec.ts` runs the menus with the fallback forced on.
- **Container query units** (Safari 16): each `cqi` size is preceded by an equivalent `vw` or
  `--cq` value.
- **Optional APIs:**
  - `checkVisibility`, `Intl.Segmenter`, view transitions, the Web Share API and the Clipboard API
    are feature-detected.
  - The features that depend on them are skipped or hidden when the API is missing.

## Performance

- WebGL setup waits until scrolling pauses, so compiling shaders never interrupts a swipe.
- Canvas scenes render at the device pixel ratio, capped at 2. On low-end devices (four cores or
  fewer, or 4 GB of memory or less) the cap is 1.5.
- Fonts are self-hosted variable fonts:
  - Inter is preloaded.
  - The extra glyphs for Turkish and Kurmanji (Ğ ğ İ Ş ş) load only on pages that use them.
  - Vazirmatn loads only when Arabic script is on screen.
- Book pages and the rug texture are served as WebP in two sizes. Fingerprinted assets are cached
  for a year.
- A `Speculation-Rules` header prerenders same-site pages on hover in Chromium browsers.

## Accessibility

- Every page is tested with axe against WCAG 2.2 AA, in both themes and on desktop and mobile.
- The site honors these preferences:
  - `prefers-reduced-motion`;
  - `prefers-contrast: more`;
  - `prefers-reduced-transparency`;
  - forced colors.
- Menus and the book reader are fully keyboard operable. Menu targets are at least 44 px, and
  every target is at least 24 px.
- Split headings keep their full text as the accessible name. Decorative copies used for effects
  are hidden from assistive technology.
- Kurdish phrases are marked `lang="ku"`. RTL pages mirror through logical properties.

## Search and machine-readable output

- **Structured data:** every page carries a JSON-LD graph
  ([`src/lib/structured-data.ts`](../src/lib/structured-data.ts)): the website, the organization,
  Hevalo, the page itself, the FAQ, and the book with its chapters.
- **Markdown versions:** every page is also published as Markdown (`/index.md`, `/de/privacy.md`,
  …).
- **llms.txt:** `/llms.txt` gives an overview, and `/llms-full.txt` holds the full English text.
  Both are built from the same sources as the pages ([`src/lib/pages.ts`](../src/lib/pages.ts)) and
  served with `noindex`.
- **Sitemap and robots.txt:** the sitemap lists every page with its `hreflang` alternates and
  `lastmod`. `robots.txt` allows all crawlers, AI assistants included.
- **Clean text:** crawlers that read raw HTML see each text exactly once. Rolling labels draw their
  letters from `data-char` attributes rather than repeating the label.

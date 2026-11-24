# Brand assets

Sources live in `src/assets/brand/`. Served files are generated from them and committed. When a
source changes, regenerate its outputs with the commands below.

## Logo

The logo is a Z whose two halves are hands reaching toward each other. Each variant has a source
PNG (`zagrosian-logo-*-source.png`).

- **Black and white** (`zagrosian-logo-dark.svg`, `zagrosian-logo-light.svg`)
  - These are vector traces, about 2 KB each, filled with `currentColor`.
  - Tracing: 6× upscale, light blur, 50% threshold, potrace, SVGO.
  - The white version is drawn slightly finer, because white on black reads heavier.
  - [`Logo.astro`](../src/components/ui/Logo.astro) inlines whichever one matches the theme.
- **Lifted** (`zagrosian-logo-lifted.svg`)
  - The hands set in a block of glass, built in CSS 3D by
    [`LiftedLogo.astro`](../src/components/home/LiftedLogo.astro).
  - Its soft shadows and inner shading are pre-rendered WebP images, because blurred box shadows
    are too costly to redraw while the block moves. Regenerate them with
    `node scripts/logo-shadows.mjs`.

When the logo changes, also regenerate the favicons, app icons and social images.

## Icons and social images

| File                                                   | Notes                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `public/favicon.svg`                                   | Black on light browsers, white on dark ones (`prefers-color-scheme` inside the SVG)    |
| `public/favicon-96.png`, `favicon-96-dark.png`         | PNG fallbacks, chosen with `media` queries                                             |
| `public/favicon.ico`                                   | 16, 32 and 48 px, black. Declared as `32x32`, so Chrome prefers the SVG                |
| `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Black logo on white, inside the maskable safe zone                                     |
| `public/og.png`, `public/og/<locale>.png`              | Logo beside the hero headline, one per language; update them when the headline changes |
| `public/og/book.jpg`                                   | Drawn by `scripts/book.mjs`                                                            |

## Color

The palette is black and white. The one accent is late sunlight (`--color-sun` and `--sun` in
`global.css`), taken from photographs of Hevalo's kilims. It appears in four places:

- behind the hero logo;
- behind the book;
- across the rug;
- on the footer wordmark.

## Rug

`src/assets/rug/rug.webp` and `rug-small.webp` are generated in a headless browser by
`node scripts/rug.mjs`. The design is original, after the pile rugs of Bijar and Senneh: a madder
field, an indigo medallion, ivory corners and a rosette border.

## Sun

The 21-ray sun is drawn from measured geometry ([`src/lib/sun.ts`](../src/lib/sun.ts)), so it is
sharp at any size. The source PNGs are kept for reference.

## Hevalo icon and deer

- The icon is served as WebP at 96, 192 and 288 px, cropped to a shared 360 px box so the regular
  and Christmas versions line up.
- The Christmas version is shown from December 1 to January 6. `theme-init.js` sets
  `data-season="christmas"` before first paint, so only the icon in season is downloaded.
- The pupils are painted out of the served images (`hevalo-eyeless-source.png`) and drawn on top
  by [`HevaloEyes.astro`](../src/components/home/HevaloEyes.astro), so they can follow the pointer.
- The products section's 3D deer is the eyeless icon split into layers in `src/assets/brand/deer/`.
  - The layers are the shade, the neck, the antlers, each ear, the head, the nose and the
    Christmas snow.
  - Regenerate them with `node scripts/deer-layers.cjs`. It prints each layer's bounding box, and
    `HevaloDeer.astro` positions the layers by those boxes.

## Fonts

- **Inter** (Latin) and **Vazirmatn** (Arabic, Sorani and Persian) are self-hosted variable fonts
  under the OFL.
- **Kurdish phrases** use the same serif stack as hevalo.app: Iowan Old Style, Palatino Linotype,
  Palatino, Georgia. These are system fonts, so nothing is downloaded.
- **Turkish and Kurmanji glyphs:** Inter's Latin file lacks Ğ ğ İ Ş ş. They come from a subset,
  `src/assets/fonts/inter-latin-extra-opsz.woff2`:

```sh
pyftsubset node_modules/@fontsource-variable/inter/files/inter-latin-ext-opsz-normal.woff2 \
  --unicodes=U+011E,U+011F,U+0130,U+015E,U+015F --layout-features='*' --flavor=woff2 \
  --output-file=src/assets/fonts/inter-latin-extra-opsz.woff2
```

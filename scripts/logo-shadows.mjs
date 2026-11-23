// Pre-renders the glass logo's soft shading (LiftedLogo.astro) as images: the drop shadow (one per
// theme) and the inner shading of the front face. They're the original CSS box-shadows rendered by
// Chromium, so the result is identical. As images they're simply scaled when the logo grows,
// whereas a blurred box-shadow is recomputed every time the logo re-rasterizes at a new size, which
// made the homepage story's fly-in stutter.
//
// The shadow canvas is 132% of the block width, offset 16% left and 5% up (matching
// LiftedLogo.astro); the shading matches the front face (inside its hairline border, which is too
// thin to matter). Units are block widths (cqi), as in the CSS.
//
// Usage: node scripts/logo-shadows.mjs (after `npm install`)
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const OUT = fileURLToPath(new URL('../src/assets/brand/', import.meta.url));
const BLOCK = 600;
const SHADOW = { left: 0.16, top: 0.05, size: 1.32 };

const shadows = {
  light: '0 10cqi 15.9cqi -5.45cqi rgb(0 0 0 / 0.36), 0 2.7cqi 5.45cqi -2.7cqi rgb(0 0 0 / 0.22)',
  dark: '0 10.9cqi 18.2cqi -5.45cqi rgb(0 0 0 / 0.9)',
};
// Front-face shading: darker along the bottom and right, with a faint inner glow. (The sharp bevel
// stays in CSS, crisp at any size.)
const shading = 'inset 0 -0.57cqi 0.85cqi rgb(0 0 0 / 0.18), inset -0.57cqi 0 0.85cqi rgb(0 0 0 / 0.08), inset 0 0 6.8cqi rgb(255 255 255 / 0.12)';

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(css, clip, file) {
  await page.setContent(`<!doctype html><style>
    html, body { margin: 0; background: transparent; }
    .frame { container-type: inline-size; position: absolute; left: 200px; top: 200px; width: ${BLOCK}px; }
    .block { aspect-ratio: 1; border-radius: 23%; ${css} }
  </style><div class="frame"><div class="block"></div></div>`);
  await page.setViewportSize({ width: BLOCK + 600, height: BLOCK + 600 });
  const png = await page.screenshot({ clip, omitBackground: true });
  await sharp(png).webp({ lossless: true, effort: 6 }).toFile(OUT + file);
  console.log(file);
}

const shadowClip = { x: 200 - SHADOW.left * BLOCK, y: 200 - SHADOW.top * BLOCK, width: SHADOW.size * BLOCK, height: SHADOW.size * BLOCK };
for (const [theme, shadow] of Object.entries(shadows)) {
  await render(`box-shadow: ${shadow};`, shadowClip, `lifted-logo-shadow-${theme}.webp`);
}
await render(`box-shadow: ${shading};`, { x: 200, y: 200, width: BLOCK, height: BLOCK }, 'lifted-logo-shading.webp');
await browser.close();

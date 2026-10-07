// Draws the glass logo's soft shading (LiftedLogo.astro) once, as images: the
// shadow the block casts (one for each theme) and the soft shading inside its
// front face. They are the CSS box shadows the logo was first drawn with,
// rendered by Chromium and saved as they are, so the logo looks the same. As
// images, the browser only stretches them when the logo grows: a blurred box
// shadow is worked out again every time the logo is drawn at a new size,
// which, as the homepage story flies into the logo, made the page stutter.
//
// The shadow is saved on a canvas 132% of the block's width, from 16% left of
// it and 5% above it (where LiftedLogo.astro places it); the shading at the
// size of the front face (inside its hairline border, which is too thin to
// matter). Each in units of the block's width (cqi), as in CSS.
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
// The front face's soft shading: darker along its foot and right side, and a
// faint glow all round inside. (Its sharp bevel stays in CSS, crisp at any size.)
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

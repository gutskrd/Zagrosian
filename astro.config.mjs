// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

const INTER = '@fontsource-variable/inter/files';

export default defineConfig({
  site: 'https://zagrosian.com',
  // Emit /privacy.html instead of /privacy/index.html so URLs stay clean on Cloudflare Pages.
  trailingSlash: 'never',
  build: {
    format: 'file',
    // The stylesheet is small; inlining it removes a render-blocking request.
    inlineStylesheets: 'always',
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['sans-serif'],
      options: {
        // Inter with the optical-size axis: tighter, sharper letterforms at display sizes.
        // Only the Latin subset is shipped, and it is preloaded. It covers Kurmanji's ê, î, û
        // and ç; ş falls back to the system font. Before publishing text with ş, add
        // `inter-latin-ext-opsz-normal.woff2` as a second variant with its own unicodeRange
        // (see @fontsource-variable/inter/opsz.css). Note <Font preload> would preload it too.
        variants: [
          {
            src: [`${INTER}/inter-latin-opsz-normal.woff2`],
            weight: '100 900',
            style: 'normal',
            unicodeRange: [
              'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
            ],
          },
        ],
      },
    },
  ],
});

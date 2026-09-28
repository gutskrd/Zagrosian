// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://zagrosian.com',
  // Emit /privacy.html instead of /privacy/index.html so URLs stay clean on Cloudflare Pages.
  trailingSlash: 'never',
  build: {
    format: 'file',
    // Styles and scripts ship as external files so the Content-Security-Policy in
    // public/_headers can forbid all inline code (no 'unsafe-inline', no hashes).
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Never inline scripts or assets as data: URIs; the CSP only allows 'self'.
      assetsInlineLimit: 0,
    },
  },
});

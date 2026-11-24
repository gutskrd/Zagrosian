// @ts-check
import { defineConfig } from 'astro/config';
import { transformWithEsbuild } from 'vite';

/**
 * Strips comments and indentation from GLSL template literals marked with a leading
 * `/* glsl *\/` comment, so shader sources stay documented without shipping the comments.
 * Line breaks are kept: preprocessor directives such as `#version` must stay on their own lines.
 *
 * @returns {import('vite').Plugin}
 */
function minifyGlsl() {
  const strip = (/** @type {string} */ source) =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');

  return {
    name: 'zagrosian:minify-glsl',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.[cm]?ts$/.test(id) || !code.includes('/* glsl */')) return null;
      return { code: code.replace(/\/\* glsl \*\/ `([^`]*)`/g, (_, body) => `\`${strip(body)}\``), map: null };
    },
  };
}

/**
 * Minifies theme-init.js. It's imported with `?url` so it can load as a render-blocking classic
 * script (BaseLayout.astro), and Vite copies such assets verbatim.
 *
 * @returns {import('vite').Plugin}
 */
function minifyThemeInit() {
  return {
    name: 'zagrosian:minify-theme-init',
    apply: 'build',
    async generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !/^_astro\/theme-init\.[\w-]+\.js$/.test(file.fileName)) continue;
        const { code } = await transformWithEsbuild(String(file.source), file.fileName, { minify: true, target: 'es2015' });
        file.source = code;
      }
    },
  };
}

export default defineConfig({
  site: 'https://zagrosian.com',
  // Emit /privacy.html rather than /privacy/index.html; Cloudflare serves it at /privacy.
  trailingSlash: 'never',
  build: {
    format: 'file',
    // Ship styles and scripts as external files so the CSP (public/_headers) can forbid all inline
    // code: no 'unsafe-inline', no hashes.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [minifyGlsl(), minifyThemeInit()],
    build: {
      // Never inline scripts or assets as data: URIs; the CSP only allows 'self'.
      assetsInlineLimit: 0,
      // A single small stylesheet for the whole site: one request, cached across pages.
      cssCodeSplit: false,
    },
  },
});

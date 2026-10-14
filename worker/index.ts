/**
 * The Worker in front of the site's static files (dist/). It sends a visitor
 * who arrives over plain http (a typed address, an old link, a QR code) to
 * the same address over https, before any page is served, and keeps the
 * expiry date of security.txt in the future without a new build.
 *
 * Without it, a first visit over http shows the page as bare HTML: the
 * Content-Security-Policy upgrades the stylesheet, fonts and scripts to
 * https, and their Cross-Origin-Resource-Policy then refuses them to an http
 * page, a different origin. Browsers only remember to use https (HSTS) after
 * one visit over https, so this happened on first visits only.
 *
 * Everything else, including every header in public/_headers, is served by
 * the static assets as before. Fingerprinted files in /_astro/ never reach
 * this Worker (see run_worker_first in wrangler.jsonc).
 */

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

/** Hosts reached during development and tests, which stay on http. */
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/** RFC 9116 asks for an expiry date within a year; 180 days, counted from today. */
const SECURITY_TXT_DAYS = 180;

function redirect(url: URL, request: Request) {
  return new Response(null, {
    // 301 for page loads; 308 keeps the method of anything else.
    status: request.method === 'GET' || request.method === 'HEAD' ? 301 : 308,
    headers: { Location: url.href, 'Cache-Control': 'public, max-age=86400' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (LOCAL.has(url.hostname)) return env.ASSETS.fetch(request);

    // First to https on the same host, as browsers' HSTS preload list asks
    // (https://hstspreload.org), so www learns to use https as well; then
    // from www to the one address of the site, https://zagrosian.com.
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      url.port = '';
      return redirect(url, request);
    }
    if (url.hostname === 'www.zagrosian.com') {
      url.hostname = 'zagrosian.com';
      return redirect(url, request);
    }

    const response = await env.ASSETS.fetch(request);

    // security.txt is built with an expiry date 180 days after the build
    // (src/pages/.well-known/security.txt.ts); served, it counts from today,
    // so it stays valid however long the site goes without a new build.
    if (url.pathname === '/.well-known/security.txt' && response.ok) {
      const expires = new Date(Date.now() + SECURITY_TXT_DAYS * 864e5);
      expires.setUTCHours(0, 0, 0, 0);
      const body = (await response.text()).replace(/^Expires: .*$/m, `Expires: ${expires.toISOString()}`);
      const headers = new Headers(response.headers);
      // Those described the file as built.
      headers.delete('Content-Length');
      headers.delete('ETag');
      return new Response(body, { status: response.status, headers });
    }

    return response;
  },
};

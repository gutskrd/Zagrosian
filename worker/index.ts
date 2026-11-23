/**
 * Worker in front of the static assets (dist/). Redirects plain-HTTP requests (typed URLs, old
 * links, QR codes) to HTTPS before anything is served, and keeps the security.txt expiry in the
 * future without rebuilding.
 *
 * Without the redirect, a first visit over HTTP rendered unstyled HTML: the CSP upgrades
 * subresources to HTTPS, and their Cross-Origin-Resource-Policy then blocks them for the
 * (cross-origin) HTTP page. HSTS only applies after a first HTTPS visit, so this only affected
 * first visits.
 *
 * Everything else, including all headers from public/_headers, is served by the assets binding.
 * Fingerprinted files under /_astro/ bypass the Worker (`run_worker_first` in wrangler.jsonc).
 */

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

/** Local hosts used in development and tests, which stay on HTTP. */
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/** RFC 9116 requires an expiry within a year; use 180 days from the request date. */
const SECURITY_TXT_DAYS = 180;

function redirect(url: URL, request: Request) {
  return new Response(null, {
    // 301 for page loads; 308 preserves the method for everything else.
    status: request.method === 'GET' || request.method === 'HEAD' ? 301 : 308,
    headers: { Location: url.href, 'Cache-Control': 'public, max-age=86400' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (LOCAL.has(url.hostname)) return env.ASSETS.fetch(request);

    // Upgrade to HTTPS on the same host first, as the HSTS preload list requires
    // (https://hstspreload.org), so www gets HSTS too; then redirect www to the canonical
    // https://zagrosian.com.
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

    // security.txt is built with an expiry 180 days after the build
    // (src/pages/.well-known/security.txt.ts); rewrite it relative to today so it stays valid
    // regardless of deploy frequency.
    if (url.pathname === '/.well-known/security.txt' && response.ok) {
      const expires = new Date(Date.now() + SECURITY_TXT_DAYS * 864e5);
      expires.setUTCHours(0, 0, 0, 0);
      const body = (await response.text()).replace(/^Expires: .*$/m, `Expires: ${expires.toISOString()}`);
      const headers = new Headers(response.headers);
      // Both describe the original body.
      headers.delete('Content-Length');
      headers.delete('ETag');
      return new Response(body, { status: response.status, headers });
    }

    return response;
  },
};

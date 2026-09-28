import type { APIRoute } from 'astro';
import { site } from '../../site';

/**
 * RFC 9116 security.txt. `Expires` is set 180 days after each build, so the
 * file stays valid as long as the site is deployed at least twice a year.
 */
const EXPIRES_AFTER_DAYS = 180;

export const GET: APIRoute = () => {
  const expires = new Date(Date.now() + EXPIRES_AFTER_DAYS * 24 * 60 * 60 * 1000);
  expires.setUTCHours(0, 0, 0, 0);

  const body = [
    `Contact: mailto:${site.contactEmail}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en, nl',
    `Canonical: ${site.url}/.well-known/security.txt`,
    `Policy: ${site.url}/security`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

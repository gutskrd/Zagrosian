/**
 * The company's registered details (src/site.ts), for the footer to show:
 * built as /registration.json. They are not written into the pages, so that
 * search engines do not list them; robots.txt asks crawlers not to fetch this
 * file, and public/_headers marks it noindex. src/scripts/registration.ts
 * reads it and puts the details in the footer for visitors.
 */
import type { APIRoute } from 'astro';
import { registration } from '../site';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(registration), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/**
 * Serves the registration details from src/site.ts as /registration.json for the footer. They're
 * kept out of the HTML so search engines don't index them: robots.txt disallows this file and
 * public/_headers marks it noindex. src/scripts/registration.ts renders them client-side.
 */
import type { APIRoute } from 'astro';
import { registration } from '../site';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(registration), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

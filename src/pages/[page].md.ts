import type { APIRoute, GetStaticPaths } from 'astro';
import { textPages } from '../lib/pages';

/** A Markdown version of every page: /index.md, /privacy.md, /terms.md, /security.md. */
export const getStaticPaths = (() =>
  textPages.map((page) => ({ params: { page: page.slug }, props: { markdown: page.markdown } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(props.markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

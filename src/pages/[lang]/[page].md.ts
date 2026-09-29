import type { APIRoute, GetStaticPaths } from 'astro';
import { textPages } from '../../lib/pages';

/** The translated pages as Markdown: /de/index.md, /de/privacy.md, … */
export const getStaticPaths = (async () =>
  (await textPages())
    .filter((page) => page.locale !== 'en')
    .map((page) => ({ params: { lang: page.locale, page: page.slug }, props: { markdown: page.markdown } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(props.markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

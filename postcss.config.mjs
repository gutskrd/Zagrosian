/**
 * PostCSS config (run by Vite on every stylesheet).
 *
 * One custom plugin for the Popover API fallback: in browsers without popover support,
 * src/scripts/utils/popover.ts marks open popovers with `.popover-open` and the root with
 * `data-popover-fallback`. Each `:popover-open` rule therefore gets a twin rule using the class,
 * scoped to the fallback root. It must be a separate rule because browsers drop any rule whose
 * selector they can't parse; and it's scoped because negated selectors like
 * `:not(:has(:popover-open))` would otherwise always match in browsers that never set the class.
 */
const fallback = '[data-popover-fallback]';

/**
 * Twin selector: `:popover-open` replaced with the class and scoped to the fallback root. Selectors
 * that start at the root (including inside Astro's `:global()`) get the attribute on the root
 * itself.
 */
const twin = (selector) => {
  const classed = selector.replaceAll(':popover-open', '.popover-open');
  const root = classed.match(/^(:global\()?(:root|html)(?![\w-])/);
  return root ? classed.slice(0, root[0].length) + fallback + classed.slice(root[0].length) : `:root${fallback} ${classed}`;
};

const popoverTwins = {
  postcssPlugin: 'popover-twins',
  Rule(rule) {
    if (!rule.selector.includes(':popover-open')) return;
    const selectors = rule.selectors.map(twin);
    // Vite runs PostCSS on component styles twice (before and after Astro scopes them); skip rules
    // already followed by their twin.
    const next = rule.next();
    if (next?.type === 'rule' && next.selectors.join() === selectors.join()) return;
    rule.after(rule.clone({ selectors }));
  },
};

export default { plugins: [popoverTwins] };

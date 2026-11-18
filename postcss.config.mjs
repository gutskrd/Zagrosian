/**
 * PostCSS, which Vite runs on every stylesheet. One step: in browsers without
 * the Popover API, src/scripts/popover.ts opens a popover with the class
 * "popover-open" and marks the page `data-popover-fallback`, so each rule for
 * `:popover-open` gets a twin for `.popover-open`, which applies only on such
 * a page. The twin is a rule of its own because those browsers drop a whole
 * rule whose selector they do not know; and it applies only there because a
 * rule that says what holds while no popover is open (`:not(:has(...))`)
 * would otherwise always hold where the class is never set.
 */
const fallback = '[data-popover-fallback]';

/**
 * One selector of the twin: on a page with the fallback, with the class for
 * the pseudo-class. A selector that starts at the root (also inside Astro's
 * `:global()`) is marked there, not looked for inside the root.
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
    // Vite runs this on a component's styles twice (before and after Astro
    // scopes them): a rule already followed by its twin is left as it is.
    const next = rule.next();
    if (next?.type === 'rule' && next.selectors.join() === selectors.join()) return;
    rule.after(rule.clone({ selectors }));
  },
};

export default { plugins: [popoverTwins] };

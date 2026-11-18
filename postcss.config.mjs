/**
 * PostCSS, which Vite runs on every stylesheet. One step: in browsers without
 * the Popover API, src/scripts/popover.ts opens a popover with the class
 * "popover-open", so each rule for `:popover-open` gets a twin for
 * `.popover-open`. The twin is a rule of its own because those browsers drop a
 * whole rule whose selector they do not know. Elsewhere the class is never
 * set, and the twins do nothing.
 */
const popoverTwins = {
  postcssPlugin: 'popover-twins',
  Rule(rule) {
    if (!rule.selector.includes(':popover-open')) return;
    rule.after(rule.clone({ selector: rule.selector.replaceAll(':popover-open', '.popover-open') }));
  },
};

export default { plugins: [popoverTwins] };

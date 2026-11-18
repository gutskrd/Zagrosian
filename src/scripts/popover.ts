/**
 * The menus (the site menu, the language menu, the book's contents) are
 * popovers: the browser opens and closes them, with no script. Browsers from
 * before the Popover API do not (Safari before 17, on iPhones and iPads that
 * stay on iOS 15 or 16; Chrome before 114; Firefox before 125): they would
 * show every menu as part of the page, and no button would open one. There
 * the same is done here, as closely as the site needs:
 *
 * - a popover is marked `data-popover` instead of `popover`, and opened by
 *   the class `popover-open`, which the stylesheet treats as `:popover-open`
 *   (postcss.config.mjs) and which global.css hides it without; while one is
 *   open, the page has `data-popover-open`, so global.css can let it cover the
 *   screen as the browser's top layer would;
 * - a button with `popovertarget` opens, closes or toggles it, a click outside
 *   it or Escape closes it (and gives the focus back to its button), and
 *   opening one closes any other;
 * - it has `showPopover`, `hidePopover` and `togglePopover`, and tells of
 *   each change with a `toggle` event that has `newState` and `oldState`.
 *
 * Other scripts ask through `isOpen` and `POPOVER`, which work either way.
 * Tests can set `window.__popoverFallback` to use this in any browser.
 */

declare global {
  interface Window {
    __popoverFallback?: boolean;
  }
}

/** Whether the browser itself does popovers. */
export const nativePopovers = !window.__popoverFallback && 'popover' in HTMLElement.prototype;

/** Every popover, either way. */
export const POPOVER = '[popover], [data-popover]';

/** Whether a popover is open. */
export const isOpen = (element: Element) =>
  nativePopovers ? element.matches(':popover-open') : element.classList.contains('popover-open');

/** Whether any popover is open. */
export const anyOpen = () => document.querySelector(nativePopovers ? ':popover-open' : '.popover-open') !== null;

function install() {
  document.documentElement.setAttribute('data-popover-fallback', '');
  for (const element of document.querySelectorAll<HTMLElement>('[popover]')) {
    element.setAttribute('data-popover', element.getAttribute('popover') === 'manual' ? 'manual' : 'auto');
    element.removeAttribute('popover');
  }

  /** The button that opened each popover, to give the focus back to. */
  const openedBy = new WeakMap<HTMLElement, HTMLElement>();
  const light = (element: Element) => element.getAttribute('data-popover') === 'auto';

  const change = (element: HTMLElement, open: boolean, invoker?: HTMLElement) => {
    if (isOpen(element) === open) return;
    if (open) {
      // One menu at a time: opening one closes the others.
      if (light(element)) {
        for (const other of document.querySelectorAll<HTMLElement>('.popover-open')) {
          if (other !== element && light(other) && !other.contains(element)) change(other, false);
        }
      }
      element.classList.add('popover-open');
      if (invoker) openedBy.set(element, invoker);
    } else {
      const hadFocus = element.contains(document.activeElement);
      element.classList.remove('popover-open');
      if (hadFocus) openedBy.get(element)?.focus();
    }
    for (const button of document.querySelectorAll<HTMLElement>('[popovertarget]')) {
      if (button.getAttribute('popovertarget') === element.id) button.setAttribute('aria-expanded', String(open));
    }
    // For the stylesheet: while one is open, nothing holds it in a box of its own (global.css).
    document.documentElement.toggleAttribute('data-popover-open', anyOpen());
    const event = Object.assign(new Event('toggle'), { oldState: open ? 'closed' : 'open', newState: open ? 'open' : 'closed' });
    element.dispatchEvent(event);
  };

  const methods = HTMLElement.prototype as HTMLElement & Record<string, unknown>;
  methods.showPopover = function (this: HTMLElement) {
    change(this, true);
  };
  methods.hidePopover = function (this: HTMLElement) {
    change(this, false);
  };
  methods.togglePopover = function (this: HTMLElement, force?: boolean) {
    change(this, force ?? !isOpen(this));
    return isOpen(this);
  };

  for (const button of document.querySelectorAll<HTMLElement>('[popovertarget]')) button.setAttribute('aria-expanded', 'false');

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const button = target.closest<HTMLElement>('[popovertarget]');
    const element = button && document.getElementById(button.getAttribute('popovertarget') ?? '');
    if (button && element?.hasAttribute('data-popover')) {
      const action = button.getAttribute('popovertargetaction');
      change(element, action === 'show' || (action !== 'hide' && !isOpen(element)), button);
      return;
    }
    // A click anywhere else closes the menus it is not in.
    for (const open of document.querySelectorAll<HTMLElement>('.popover-open')) {
      if (light(open) && !open.contains(target)) change(open, false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const open = [...document.querySelectorAll<HTMLElement>('.popover-open')].filter(light).pop();
    if (open) change(open, false);
  });
}

if (!nativePopovers) install();

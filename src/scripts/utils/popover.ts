/**
 * Popover API fallback.
 *
 * The site menu, language menu and book contents are native popovers. Browsers without the Popover
 * API (Safari < 17, i.e. iPhones and iPads stuck on iOS 15/16; Chrome < 114; Firefox < 125) would
 * render every menu inline with no way to open it. This module emulates what the site needs:
 *
 * - `popover` is swapped for `data-popover`, and the open state is the `popover-open` class.
 *   postcss.config.mjs duplicates every `:popover-open` rule for that class, and global.css hides
 *   closed popovers and, while one is open (`data-popover-open` on the root), lets it escape the
 *   header's containing block the way the top layer would.
 * - `popovertarget` buttons open, close or toggle their target; outside clicks and Escape close it
 *   and return focus to the invoker; opening one closes the others.
 * - `showPopover()`, `hidePopover()` and `togglePopover()` are provided, and changes dispatch
 *   `toggle` events with `newState` and `oldState`.
 *
 * Other modules use `isOpen` and `POPOVER`, which work in both modes. Tests can force the fallback
 * with `window.__popoverFallback`.
 */

declare global {
  interface Window {
    __popoverFallback?: boolean;
  }
}

/** Native Popover API support. */
const nativePopovers = !window.__popoverFallback && 'popover' in HTMLElement.prototype;

/** Selector matching popovers in either mode. */
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

  /** Invoker of each open popover, to return focus to on close. */
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
    // Lets global.css release open popovers from the header's containing block.
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
    // Light dismiss: an outside click closes every popover it isn't inside.
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

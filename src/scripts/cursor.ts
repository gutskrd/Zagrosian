/**
 * A custom cursor, for a mouse or trackpad (styles in global.css, `.cursor`).
 *
 * A ring, exactly where the pointer is, with no lag. What is under the pointer
 * changes it:
 * - a link or a plain button: it fills and inverts the text beneath, like a
 *   lens; an external link adds an arrow pointing out;
 * - a magnetic button: it steps aside, and the button leans towards the
 *   pointer instead (magnetic.ts);
 * - a text field: the system's text cursor returns.
 * Pressing tightens it.
 *
 * It never lingers where the pointer no longer is: it disappears when the
 * pointer leaves the window, the window loses focus or the page is left (so
 * it is not frozen into the page transition), and returns with the next move.
 *
 * Touch screens, reduced motion and forced colours keep the system cursor.
 * It stays visible above dialogs and the menu (see the top layer below).
 * The elements are created with the DOM API; nothing is written as HTML.
 */

const root = document.documentElement;

type State = 'link' | 'external' | 'button' | 'text' | '';

function stateOf(target: Element | null): State {
  if (!target) return '';
  if (target.closest('input, textarea, select, [contenteditable]')) return 'text';
  if (target.closest('[data-magnetic]')) return 'button';
  if (target.closest('button, [role="option"], summary, label')) return 'link';
  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (link) {
    const url = new URL(link.href, location.href);
    return url.origin !== location.origin && url.protocol.startsWith('http') ? 'external' : 'link';
  }
  return '';
}

export function initCursor() {
  if (
    !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(forced-colors: active)').matches ||
    // It needs the Popover API to stay above dialogs and the menu.
    !('showPopover' in HTMLElement.prototype)
  ) {
    return;
  }

  const make = (className: string) => {
    const element = document.createElement('div');
    element.className = className;
    return element;
  };
  const cursor = make('cursor');
  cursor.setAttribute('aria-hidden', 'true');
  const ring = make('cursor__ring');
  ring.append(make('cursor__shape'));

  // The arrow shown over external links.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'cursor__label');
  svg.setAttribute('viewBox', '0 0 16 16');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4.5 11.5l7-7M5.5 4.5h6v6');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  ring.append(svg);

  cursor.append(ring);
  document.body.append(cursor);

  // Dialogs and the menu open in the browser's top layer, above the page. The
  // cursor lives in the top layer too (a manual popover), and moves back on
  // top whenever one of them opens, so it is never hidden beneath them.
  cursor.popover = 'manual';
  const show = () => {
    try {
      if (cursor.matches(':popover-open')) cursor.hidePopover();
      cursor.showPopover();
    } catch {
      // The page is changing.
    }
  };
  show();
  document.addEventListener(
    'toggle',
    (event) => {
      if (event.target !== cursor && (event as ToggleEvent).newState === 'open') show();
    },
    true,
  );
  for (const dialog of document.querySelectorAll('dialog')) {
    new MutationObserver(() => dialog.open && show()).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }

  root.classList.add('has-cursor');

  let x = -100;
  let y = -100;
  let state: State = '';

  const setState = (next: State) => {
    if (next === state) return;
    state = next;
    if (next) cursor.dataset.state = next;
    else delete cursor.dataset.state;
  };

  const fade = () => cursor.toggleAttribute('data-visible', false);
  // Gone at once, not faded: used when leaving the page, before the browser
  // takes its picture of it for the transition.
  const vanish = () => {
    fade();
    try {
      cursor.hidePopover();
    } catch {
      // Already hidden.
    }
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      x = event.clientX;
      y = event.clientY;
      ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (!cursor.matches(':popover-open')) show();
      if (!cursor.hasAttribute('data-visible')) cursor.toggleAttribute('data-visible', true);
    },
    { passive: true },
  );

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'touch') setState(stateOf(event.target as Element | null));
  });

  // Leaving the window, switching to another app or tab, leaving the page.
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) fade();
  });
  document.documentElement.addEventListener('pointerleave', fade);
  window.addEventListener('blur', fade);
  document.addEventListener('visibilitychange', () => document.hidden && fade());
  window.addEventListener('pageswap', vanish);
  window.addEventListener('pagehide', vanish);

  window.addEventListener('pointerdown', () => cursor.toggleAttribute('data-pressed', true), { passive: true });
  window.addEventListener('pointerup', () => cursor.toggleAttribute('data-pressed', false), { passive: true });

  // Scrolling moves content under a still pointer.
  document.addEventListener('scroll', () => setState(stateOf(document.elementFromPoint(x, y))), { passive: true });
}

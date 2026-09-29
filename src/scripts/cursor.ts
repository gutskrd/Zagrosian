/**
 * A custom cursor, for a mouse or trackpad (styles in global.css, `.cursor`).
 *
 * A dot inside a ring, both exactly where the pointer is, with no lag.
 * What is under the pointer changes it:
 * - a link or a plain button: the ring fills and inverts the text beneath,
 *   like a lens; an external link adds an arrow pointing out;
 * - a magnetic button: the cursor steps aside, and the button leans towards
 *   the pointer instead (magnetic.ts);
 * - a text field: the system's text cursor returns;
 * - the ink horseman: a wide, light ring.
 * Pressing tightens the ring.
 *
 * Touch screens, reduced motion and forced colours keep the system cursor.
 * It stays visible above dialogs and the menu (see the top layer below).
 * The elements are created with the DOM API; nothing is written as HTML.
 */

const root = document.documentElement;

type State = 'link' | 'external' | 'button' | 'text' | 'wind' | '';

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
  if (target.closest('[data-cursor="wind"]')) return 'wind';
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

  const make = (className: string, tag = 'div') => {
    const element = document.createElement(tag);
    element.className = className;
    return element;
  };
  const cursor = make('cursor');
  cursor.setAttribute('aria-hidden', 'true');
  const dot = make('cursor__dot');
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

  cursor.append(ring, dot);
  document.body.append(cursor);

  // Dialogs and the menu open in the browser's top layer, above the page. The
  // cursor lives in the top layer too (a manual popover), and moves back on
  // top whenever one of them opens, so it is never hidden beneath them.
  cursor.popover = 'manual';
  cursor.showPopover();
  const raise = () => {
    try {
      cursor.hidePopover();
      cursor.showPopover();
    } catch {
      // Already on top, or the page is changing.
    }
  };
  document.addEventListener(
    'toggle',
    (event) => {
      if (event.target !== cursor && (event as ToggleEvent).newState === 'open') raise();
    },
    true,
  );
  for (const dialog of document.querySelectorAll('dialog')) {
    new MutationObserver(() => dialog.open && raise()).observe(dialog, { attributes: true, attributeFilter: ['open'] });
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

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      x = event.clientX;
      y = event.clientY;
      // Both move at once, in the same frame as the pointer: no lag.
      const at = `translate3d(${x}px, ${y}px, 0)`;
      dot.style.transform = at;
      ring.style.transform = at;
      if (!cursor.hasAttribute('data-visible')) cursor.toggleAttribute('data-visible', true);
    },
    { passive: true },
  );

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'mouse') setState(stateOf(event.target as Element | null));
  });

  // Leaving the window, and coming back.
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) cursor.toggleAttribute('data-visible', false);
  });

  window.addEventListener('pointerdown', () => cursor.toggleAttribute('data-pressed', true), { passive: true });
  window.addEventListener('pointerup', () => cursor.toggleAttribute('data-pressed', false), { passive: true });

  // A page change or a dialog can move content under a still pointer.
  document.addEventListener('scroll', () => setState(stateOf(document.elementFromPoint(x, y))), { passive: true });
}

/**
 * A custom cursor, for a mouse or trackpad (styles in global.css, `.cursor`).
 *
 * A dot follows the pointer exactly; a ring trails it with a little weight.
 * What is under the pointer changes it:
 * - a link or a plain button: the ring fills and inverts the text beneath,
 *   like a lens; an external link adds an arrow pointing out;
 * - a magnetic button: the cursor steps aside, and the button leans towards
 *   the pointer instead (magnetic.ts);
 * - a text field: the system's text cursor returns;
 * - the ink horseman: a wide, light ring.
 * Pressing tightens the ring.
 *
 * Touch screens, reduced motion and forced colours keep the system cursor,
 * and it returns while a dialog or menu is open (they sit above the page).
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
    window.matchMedia('(forced-colors: active)').matches
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
  root.classList.add('has-cursor');

  let x = -100;
  let y = -100;
  let ringX = x;
  let ringY = y;
  let frame = 0;
  let last = 0;
  let state: State = '';

  const follow = (now: number) => {
    const seconds = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    const k = 1 - Math.exp(-seconds * 16);
    ringX += (x - ringX) * k;
    ringY += (y - ringY) * k;
    ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0)`;
    if (Math.abs(x - ringX) + Math.abs(y - ringY) > 0.1) frame = requestAnimationFrame(follow);
    else {
      frame = 0;
      last = 0;
    }
  };

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
      // The dot moves at once, in the same frame as the pointer.
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (!cursor.hasAttribute('data-visible')) {
        ringX = x;
        ringY = y;
        cursor.toggleAttribute('data-visible', true);
      }
      if (!frame) frame = requestAnimationFrame(follow);
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

/**
 * Buttons that answer the pointer (with a mouse or trackpad):
 *
 * - Magnetic (`data-magnetic`): the button leans towards the pointer while it
 *   is over it, its label (`data-magnetic-inner`) a little further, and springs
 *   back when the pointer leaves.
 * - Pour (`data-pour`): the button's hover colour pours in from the point where
 *   the pointer entered, and drains out towards where it left
 *   (the `--pour-x`/`--pour-y` custom properties; styles in Cta.astro).
 *
 * Only the individual `translate` property and custom properties are set,
 * through the CSSOM, so the Content-Security-Policy stays strict and other
 * transforms (a press, a reveal) are left alone.
 */

export function initMagnetic() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  for (const element of document.querySelectorAll<HTMLElement>('[data-pour]')) {
    const pour = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      element.style.setProperty('--pour-x', `${(event.clientX - rect.left).toFixed(0)}px`);
      element.style.setProperty('--pour-y', `${(event.clientY - rect.top).toFixed(0)}px`);
    };
    element.addEventListener('pointerenter', pour);
    element.addEventListener('pointerleave', pour);
  }

  if (reduced) return;

  for (const element of document.querySelectorAll<HTMLElement>('[data-magnetic]')) {
    const inner = element.querySelector<HTMLElement>('[data-magnetic-inner]');
    // A damped spring: it follows the pointer, and overshoots a little on the
    // way back when the pointer leaves.
    const spring = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    let frame = 0;
    let last = 0;

    const step = (now: number) => {
      const seconds = last ? Math.min(0.032, (now - last) / 1000) : 0.016;
      last = now;
      const ax = 180 * (spring.tx - spring.x) - 16 * spring.vx;
      const ay = 180 * (spring.ty - spring.y) - 16 * spring.vy;
      spring.vx += ax * seconds;
      spring.vy += ay * seconds;
      spring.x += spring.vx * seconds;
      spring.y += spring.vy * seconds;
      const settled =
        Math.abs(spring.tx - spring.x) + Math.abs(spring.ty - spring.y) < 0.05 &&
        Math.abs(spring.vx) + Math.abs(spring.vy) < 0.05;
      if (settled) {
        spring.x = spring.tx;
        spring.y = spring.ty;
      }
      const at = (k: number) =>
        spring.x === 0 && spring.y === 0 ? '' : `${(spring.x * k).toFixed(2)}px ${(spring.y * k).toFixed(2)}px`;
      element.style.translate = at(1);
      if (inner) inner.style.translate = at(0.4);
      if (settled) {
        frame = 0;
        last = 0;
      } else {
        frame = requestAnimationFrame(step);
      }
    };
    const start = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    element.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const rect = element.getBoundingClientRect();
      // Measured from where the button rests, so the pull stays steady.
      spring.tx = (event.clientX - (rect.left - spring.x + rect.width / 2)) * 0.3;
      spring.ty = (event.clientY - (rect.top - spring.y + rect.height / 2)) * 0.4;
      start();
    });

    element.addEventListener('pointerleave', () => {
      spring.tx = 0;
      spring.ty = 0;
      start();
    });
  }
}

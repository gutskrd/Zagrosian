/**
 * Hevalo's eyes follow the pointer: the mouse, or on a touch screen the
 * finger, while it touches the screen and a moment after. With nothing to
 * follow, the pupils return to where the artwork has them, turned in towards
 * each other. They are drawn over the icon (HevaloIcon.astro) and move within
 * the white of each eye, easing towards where they look.
 *
 * Only icons on screen are updated, and nothing runs while the eyes are
 * still. Not used when the visitor prefers reduced motion.
 */

/** The white of an eye, and how far a pupil's centre may move from its centre (source pixels). */
const EYE = { width: 58, height: 68 };
const REACH = { x: 13, y: 10 };
/** Where each pupil's centre is drawn in the artwork: left eye, right eye. */
const REST = [
  { x: 40.6, y: 36 },
  { x: 19.3, y: 36.1 },
];
/** How long the eyes keep looking at where a finger left the screen (ms). */
const LINGER = 1500;

interface Pupil {
  element: HTMLElement;
  eye: HTMLElement;
  rest: { x: number; y: number };
  x: number;
  y: number;
}

export function initEyes() {
  const icons = [...document.querySelectorAll<HTMLElement>('[data-hevalo-eyes]')];
  if (icons.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const pupils = new Map<HTMLElement, Pupil[]>();
  for (const icon of icons) {
    const list = [...icon.querySelectorAll<HTMLElement>('[data-pupil]')].map((element, index) => {
      const rest = REST[index % 2];
      return { element, eye: element.parentElement as HTMLElement, rest, x: rest.x, y: rest.y };
    });
    pupils.set(icon, list);
  }

  const visible = new Set<HTMLElement>();
  let pointer: { x: number; y: number } | null = null;
  let release: number | undefined;
  let running = false;

  const frame = () => {
    let moving = false;
    for (const icon of visible) {
      for (const pupil of pupils.get(icon) ?? []) {
        const box = pupil.eye.getBoundingClientRect();
        if (box.width === 0) continue;
        let target = pupil.rest;
        if (pointer) {
          // Towards the pointer, further the further away it is.
          const dx = pointer.x - (box.left + box.width / 2);
          const dy = pointer.y - (box.top + box.height / 2);
          const distance = Math.hypot(dx, dy) || 1;
          const reach = Math.min(1, distance / (box.width * 3 + 40));
          target = {
            x: EYE.width / 2 + (dx / distance) * REACH.x * reach,
            y: EYE.height / 2 + (dy / distance) * REACH.y * reach,
          };
        }
        pupil.x += (target.x - pupil.x) * 0.2;
        pupil.y += (target.y - pupil.y) * 0.2;
        if (Math.abs(target.x - pupil.x) + Math.abs(target.y - pupil.y) > 0.05) moving = true;
        else {
          pupil.x = target.x;
          pupil.y = target.y;
        }
        const scale = box.width / EYE.width;
        const x = (pupil.x - pupil.rest.x) * scale;
        const y = (pupil.y - pupil.rest.y) * scale;
        pupil.element.style.translate = Math.abs(x) + Math.abs(y) < 0.01 ? '' : `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      }
    }
    if (moving) requestAnimationFrame(frame);
    else running = false;
  };

  const update = () => {
    if (running || visible.size === 0) return;
    running = true;
    requestAnimationFrame(frame);
  };

  const look = (x: number, y: number) => {
    window.clearTimeout(release);
    pointer = { x, y };
    update();
  };

  const rest = () => {
    pointer = null;
    update();
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
      else visible.delete(entry.target as HTMLElement);
    }
    update();
  });
  for (const icon of icons) observer.observe(icon);

  // A mouse or pen.
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'touch') look(event.clientX, event.clientY);
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', rest);

  // A finger: while it touches (scrolling included) and a moment after.
  const touch = (event: TouchEvent) => {
    const point = event.touches[0];
    if (point) look(point.clientX, point.clientY);
  };
  window.addEventListener('touchstart', touch, { passive: true });
  window.addEventListener('touchmove', touch, { passive: true });
  const lift = () => {
    window.clearTimeout(release);
    release = window.setTimeout(rest, LINGER);
  };
  window.addEventListener('touchend', lift, { passive: true });
  window.addEventListener('touchcancel', lift, { passive: true });

  // The page moves under a still pointer when it scrolls.
  window.addEventListener('scroll', () => pointer && update(), { passive: true });
}

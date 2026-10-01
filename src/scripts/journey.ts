/**
 * The homepage logo's journey down the page (Hero.astro, ProductShowcase.astro,
 * Motto.astro).
 *
 * The glass logo leaves its place in the hero and stays on the screen as the
 * page scrolls. It glides to the middle and turns to face the reader, then
 * grows until it fills the screen. Shrinking back, it turns over, as one solid
 * block, to the Kurdish sun. The products band rises over it like a curtain;
 * when the band has passed, the sun is still there, and the motto comes up to
 * meet it: the glass melts away and the sun settles in above the motto, in
 * the place, size, turn and colour of the motto's own sun, which then takes
 * over. Scrolling back plays it all backwards.
 *
 * How: the hero's logo is copied into a layer fixed to the screen, which this
 * script moves, scales and turns as the page scrolls; the original stays in
 * the hero, unseen, for screen readers. The motto's sun is hidden until the
 * travelling one lands on it. The page is measured on load and resize, never
 * while scrolling; each frame only sets a transform, custom properties and
 * attributes, through the CSSOM (which the Content-Security-Policy allows).
 *
 * theme-init.js makes room for the journey (`data-journey`) before the first
 * paint when motion is welcome; this script turns it on. Without JavaScript or
 * with reduced motion, the logo stays in the hero and the motto keeps its sun.
 */

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/** Between two sizes, so that each step of the scroll scales by the same factor. */
const zoom = (from: number, to: number, t: number) => from * (to / from) ** t;

/** 0 to 1 between two points, easing in and out. */
const ease = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** The logo's pose at rest in the hero, as LiftedLogo.astro draws it. */
const REST_PITCH = 12;
const REST_YAW = -18;

/** Its size while it hovers, sun side up, as a share of its size in the hero. */
const HOVER = 0.75;

/** The sun's share of the logo's width (LiftedLogo.astro: inset 16%). */
const SUN = 0.68;

/** How far the sun turns for each pixel scrolled. */
const SUN_SPIN = 0.04;

/** How far the motto's sun turns as it crosses the screen (motion.ts, `data-spin`). */
const MOTTO_SPIN = 60;

/** The smallest half-width of the logo (corners 23% of its width) that covers a box of half-size a × b. */
const coverHalf = (a: number, b: number) => {
  let half = Math.max(a, b);
  for (;;) {
    const radius = 0.46 * half;
    const dx = Math.max(0, a - (half - radius));
    const dy = Math.max(0, b - (half - radius));
    if (dx * dx + dy * dy <= radius * radius) return half;
    half *= 1.01;
  }
};

/** An element's position on the page, from layout alone (transforms aside). */
const place = (element: HTMLElement) => {
  let x = 0;
  let y = 0;
  for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y, width: element.offsetWidth, height: element.offsetHeight };
};

export function initJourney() {
  const root = document.documentElement;
  const from = document.querySelector<HTMLElement>('[data-journey-from]');
  const logo = from?.querySelector<HTMLElement>('.lifted-logo');
  const layer = document.querySelector<HTMLElement>('[data-journey-layer]');
  const art = layer?.querySelector<HTMLElement>('.journey__art');
  const tilt = art?.firstElementChild;
  const curtain = document.querySelector<HTMLElement>('[data-journey-curtain]');
  const dock = document.querySelector<HTMLElement>('[data-journey-dock]');
  if (!root.dataset.journey || !from || !logo || !layer || !art || !(tilt instanceof HTMLElement) || !curtain || !dock) {
    return;
  }

  // The copy that travels: decoration, as the original keeps the label.
  const copy = logo.cloneNode(true) as HTMLElement;
  copy.removeAttribute('role');
  copy.removeAttribute('aria-label');
  copy.setAttribute('aria-hidden', 'true');
  tilt.append(copy);

  // The page, measured: the logo's place and size in the hero; the screen;
  // where the products band begins and ends; and the sun's place in the motto.
  let size = 0;
  let startX = 0;
  let startY = 0;
  let width = 0;
  let height = 0;
  let fill = 1;
  let land = 0.2;
  let landX = 0;
  let landY = 0;
  let spinTop = 0;
  let spinHeight = 0;
  // Scroll positions: the end of the show (the band's top edge reaches the
  // middle of the screen), the hidden stretch behind the band, and the
  // stretch in which the sun comes down to the motto and lands.
  let showEnd = 1;
  let hideFrom = 0;
  let hideTo = 0;
  let approach = 0;
  let landAt = 0;

  const measure = () => {
    const start = place(from);
    const band = place(curtain);
    // The motto's sun fills its box (Sun.astro), which turns as it scrolls.
    const sun = place(dock);
    // The layout viewport: on phones it keeps its height as the address bar
    // slides away, so the logo does not jump.
    width = root.clientWidth;
    height = root.clientHeight;
    size = start.width;
    startX = start.x + size / 2;
    startY = start.y + size / 2;
    // Filled, the inside of the frame (93% of the logo) covers the screen.
    fill = ((coverHalf(width / 2, height / 2) / 0.907) * 2 * 1.03) / size;
    land = sun.width / (SUN * size);
    landX = sun.x + sun.width / 2;
    landY = sun.y + sun.height / 2;
    spinTop = sun.y;
    spinHeight = sun.height;

    const hover = (HOVER * size) / 2;
    showEnd = Math.max(1, band.y - height / 2);
    hideFrom = showEnd + hover + height * 0.15;
    approach = Math.max(showEnd + 1, band.y + band.height - height / 2 - hover);
    hideTo = approach - height * 0.15;
    landAt = Math.max(approach + 1, landY - height / 2);

  };

  const written = new Map<string, string>();
  const set = (name: string, value: string) => {
    if (written.get(name) === value) return;
    written.set(name, value);
    if (name === 'transform') art.style.transform = value;
    else if (name === 'size') art.style.width = art.style.height = value;
    else layer.style.setProperty(name, value);
  };

  const render = () => {
    const scroll = Math.max(0, window.scrollY);
    const middleX = width / 2;
    const middleY = height / 2;
    const u = clamp(scroll / showEnd);

    let x: number;
    let y: number;
    let scale: number;
    let pitch: number;
    let yaw: number;
    let glass = 1;
    let lights = 1;

    // The show. It glides to the middle of the screen, facing the reader,
    // keeping to its side until the hero's text has gone…
    const glide = ease(0, 0.3, u);
    x = mix(startX, middleX, ease(0.08, 0.3, u));
    y = mix(startY, middleY, glide);
    pitch = mix(REST_PITCH, 0, glide);
    yaw = mix(REST_YAW, 0, glide);

    // …grows until it fills the screen, and holds there a moment…
    if (u < 0.3) scale = mix(1, 1.2, glide);
    else if (u < 0.5) scale = zoom(1.2, fill, ease(0.3, 0.5, u));
    else if (u < 0.58) scale = fill * mix(1, 1.06, (u - 0.5) / 0.08);
    // …then shrinks back, turning over to the sun…
    else if (u < 0.86) scale = zoom(fill * 1.06, HOVER * 1.1, ease(0.58, 0.86, u));
    // …and settles, hovering, leaning back a little.
    else scale = mix(HOVER * 1.1, HOVER, ease(0.86, 1, u));

    const flip = ease(0.62, 0.88, u);
    const settle = ease(0.88, 1, u);
    yaw += flip * 180 + settle * 16;
    pitch += -14 * Math.sin(Math.PI * flip) + settle * 8;

    // The sun grows into place as it comes round, and turns with the scroll.
    const grown = ease(0.7, 0.88, u);
    const sunSize = mix(0.72, 1, grown);
    let sunTurn = scroll * SUN_SPIN - (1 - grown) * 40;

    // After the curtain: the motto comes up to meet the sun, which shrinks to
    // the size of the motto's sun, comes round to its turn and leaves the
    // glass behind as it lands.
    const landed = scroll >= landAt;
    if (scroll > approach) {
      const a = ease(approach, landAt, scroll);
      const mottoTurn = clamp((window.innerHeight - (spinTop - scroll)) / (window.innerHeight + spinHeight)) * MOTTO_SPIN;
      x = mix(middleX, landX, a);
      y = middleY;
      scale = zoom(HOVER, land, a);
      pitch = mix(8, 0, a);
      yaw = mix(196, 180, a);
      glass = 1 - ease(0.3, 0.95, a);
      lights = 1 - ease(0, 0.8, a);
      sunTurn = mix(sunTurn, mottoTurn, a);
    }

    // Landed, the motto's own sun takes over.
    layer.toggleAttribute('data-landed', landed);
    dock.toggleAttribute('data-landed', landed);
    if (landed) return;

    // Smaller than in the hero, the logo is laid out at its size rather than
    // scaled down, so the browser draws it sharp; larger, it is scaled up.
    const box = size * Math.min(1, scale);
    set('size', `${box.toFixed(2)}px`);
    set('transform', `translate3d(${(x - box / 2).toFixed(2)}px, ${(y - box / 2).toFixed(2)}px, 0) scale(${(scale * (size / box)).toFixed(4)})`);
    set('--tilt', `${(pitch - REST_PITCH).toFixed(2)}deg`);
    set('--turn', `${(yaw - REST_YAW).toFixed(2)}deg`);
    set('--sun-size', sunSize.toFixed(4));
    set('--sun-turn', `${sunTurn.toFixed(2)}deg`);
    set('--glint', `${(clamp(yaw / 90) * -130).toFixed(1)}%`);
    set('--glint-sun', `${(clamp((180 - yaw) / 90, -1, 1) * 130).toFixed(1)}%`);
    set('--turned', clamp(yaw / 180).toFixed(4));
    set('--glass', glass.toFixed(3));
    set('--lights', lights.toFixed(3));

    // Hidden while the band covers it.
    layer.toggleAttribute('data-hidden', scroll > hideFrom && scroll < hideTo);

    // Nothing is drawn that cannot be seen: the side turned away, and the
    // block's edge while the logo fills the screen face on. (Drawn at that
    // size, its twenty layers would cost far more than they show.)
    const side = yaw < 80 ? 'logo' : yaw > 100 ? 'sun' : 'both';
    if (layer.dataset.side !== side) layer.dataset.side = side;
    layer.toggleAttribute('data-flat', scale * size > Math.max(width, height) * 0.9);
  };

  let queued = false;
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  };

  measure();
  render();
  root.dataset.journey = 'on';

  // The page reflows when fonts arrive or the window changes size.
  new ResizeObserver(() => {
    measure();
    request();
  }).observe(document.body);
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener(
    'resize',
    () => {
      measure();
      request();
    },
    { passive: true },
  );
}

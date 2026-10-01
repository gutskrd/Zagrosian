/**
 * The homepage walkthrough (Story.astro), and the glass logo's way into it
 * from the hero (Hero.astro).
 *
 * As the hero scrolls away, the glass logo stays on the screen and settles
 * beside the story's values, which the page pins in place. Then, as the page
 * scrolls on:
 *
 * 1. The values rise one by one, and the logo turns a notch with each.
 * 2. The values lift away; the logo comes to the middle, faces the reader and
 *    the camera dives into its ink. The logo is handed over to a flat vector
 *    copy for this (`.story__lens`), so it stays sharp however close it gets.
 * 3. The ink becomes a scene in the other theme's colours, where the Kurdish
 *    sun rises, comes to rest and the motto rises under it, word by word.
 * 4. The scene closes into the sun like an iris, and leaves the sun and the
 *    motto in the page's own colours. The stage lets go and they scroll on.
 *
 * Scrolling back plays it all backwards. Everything is a function of the
 * scroll position: the page is measured on load and resize only, and each
 * frame sets transforms, opacity and a clip path, through the CSSOM and SVG
 * attributes (both allowed by the Content-Security-Policy).
 *
 * theme-init.js makes room for the walkthrough (`data-story`) before the first
 * paint when motion is welcome; this script turns it on. Without JavaScript or
 * with reduced motion, the story is a plain section and the logo stays in the
 * hero.
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

/** The logo's pose at rest, as LiftedLogo.astro draws it. */
const REST_PITCH = 12;
const REST_YAW = -18;

/* Where each chapter sits along the pinned scroll, from 0 to 1. */
/** When each value starts to rise, and how long it takes. */
const VALUES = [-0.02, 0.1, 0.21];
const RISE = 0.07;
/** All three lit together, then lifting away. */
const STATEMENT = 0.31;
const LIFT = [0.38, 0.44];
/** The logo comes to the middle; the dive; the ink becomes the scene. */
const DIVE = [0.38, 0.47, 0.56];
/** How long the glass logo and its vector copy overlap at the handover. */
const HANDOVER = 0.012;
/** The sun rises to the middle, then comes to rest above the motto. */
const SUN = [0.56, 0.67, 0.75];
/** The motto rises word by word; then its translation. */
const WORDS = [0.69, 0.79];
const TRANSLATION = [0.76, 0.81];
/** The scene closes into the sun. */
const IRIS = [0.83, 0.97];

/**
 * Where the camera dives in, in the logo's 1290-unit tile: the deepest point
 * of its ink (the smoked parts on the light page, the frosted ones on the dark
 * page), and how far the ink reaches around it. Found with a distance
 * transform of the shapes.
 */
const INK = {
  light: { x: 762, y: 786, reach: 143 },
  dark: { x: 1020, y: 1020, reach: 187 },
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

export function initStory() {
  const root = document.documentElement;
  const story = document.querySelector<HTMLElement>('[data-story-section]');
  const stage = story?.firstElementChild;
  const from = document.querySelector<HTMLElement>('[data-journey-from]');
  const logo = from?.querySelector<HTMLElement>('.lifted-logo');
  const layer = document.querySelector<HTMLElement>('[data-journey-layer]');
  const art = layer?.querySelector<HTMLElement>('.journey__art');
  const tilt = art?.firstElementChild;
  if (
    !root.dataset.story ||
    !story ||
    !(stage instanceof HTMLElement) ||
    !from ||
    !logo ||
    !layer ||
    !art ||
    !(tilt instanceof HTMLElement)
  ) {
    return;
  }

  const find = <T extends Element = HTMLElement>(selector: string) => story.querySelector<T>(selector);
  const slot = find('[data-story-slot]');
  const heading = find('.story__values');
  const values = [...story.querySelectorAll<HTMLElement>('[data-story-value] > span')];
  const lens = find<SVGSVGElement>('[data-story-lens]');
  const lensLogo = find<SVGGElement>('[data-story-lens-logo]');
  const motto = find('[data-story-motto]');
  const sun = find('[data-story-sun]');
  const scene = find('[data-story-scene]');
  const sunrise = find('[data-story-sunrise]');
  const words = [...story.querySelectorAll<HTMLElement>('[data-story-word]')];
  const translation = find('[data-story-translation]');
  const progress = find('[data-story-progress]');
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!slot || !heading || !lens || !lensLogo || !motto || !sun || !scene || !sunrise || !progress) return;

  // The copy of the logo that travels: decoration, as the original keeps the label.
  const copy = logo.cloneNode(true) as HTMLElement;
  copy.removeAttribute('role');
  copy.removeAttribute('aria-label');
  copy.setAttribute('aria-hidden', 'true');
  tilt.append(copy);

  // The page, measured: the screen; the logo's place in the hero; where the
  // story starts and how long it stays pinned; and, on the stage, the logo's
  // place beside the values and the sun's place above the motto.
  let width = 0;
  let height = 0;
  let stageHeight = 0;
  let start = { x: 0, y: 0, size: 1 };
  let storyTop = 0;
  let pinned = 1;
  let rest = { x: 0, y: 0, size: 1 };
  let sunAt = { x: 0, y: 0, size: 1 };
  let dive = 1;
  let depth = 1;
  let cover = 1;

  const measure = () => {
    // The layout viewport: on phones it keeps its height as the address bar
    // slides away, so nothing jumps.
    width = root.clientWidth;
    height = root.clientHeight;
    const hero = place(from);
    const top = place(stage);
    const spot = place(slot);
    const disc = place(sun);
    stageHeight = stage.offsetHeight;
    start = { x: hero.x + hero.width / 2, y: hero.y + hero.width / 2, size: hero.width };
    storyTop = place(story).y;
    pinned = Math.max(1, story.offsetHeight - stageHeight);
    rest = { x: spot.x - top.x + spot.width / 2, y: spot.y - top.y + spot.width / 2, size: spot.width || hero.width };
    sunAt = { x: disc.x - top.x + disc.width / 2, y: disc.y - top.y + disc.height / 2, size: disc.width };
    // Faced, the logo fills most of the shorter side of the screen (and never
    // shrinks to get there); the scene's circle starts out large enough to
    // cover the whole stage.
    dive = Math.max(rest.size * 1.15, Math.min(width, stageHeight) * 0.62);
    // In the glass, the logo sits 45% of the way through a block 7% as deep
    // as it is wide, so in perspective it looks a little smaller than the
    // block: the vector copy matches the logo, not the block.
    const perspective = parseFloat(getComputedStyle(art).perspective) || 1280;
    depth = perspective / (perspective + 0.45 * 0.07 * dive);
    cover = Math.hypot(Math.max(sunAt.x, width - sunAt.x), Math.max(sunAt.y, stageHeight - sunAt.y)) + 2;
  };

  const written = new Map<string, string>();
  const write = (key: string, value: string, apply: (value: string) => void) => {
    if (written.get(key) === value) return;
    written.set(key, value);
    apply(value);
  };
  const style = (element: HTMLElement | SVGElement, name: string, value: string, key = name) =>
    write(`${key}`, value, (v) => element.style.setProperty(name, v));
  const shown = (element: HTMLElement | SVGElement, visible: boolean, key: string) =>
    style(element, 'visibility', visible ? 'visible' : '', key);

  const render = () => {
    const scroll = Math.max(0, window.scrollY);
    const q = (scroll - storyTop) / pinned;
    const middleX = width / 2;
    const middleY = stageHeight / 2;

    // ---- The glass logo: down from the hero, beside the values, to the middle.
    const glide = ease(0, storyTop, scroll);
    const risen = VALUES.map((at) => ease(at, at + RISE, q));
    const turned = risen.reduce((sum, value) => sum + value, 0);
    const faced = ease(DIVE[0], DIVE[1] - HANDOVER, q);

    let x = mix(start.x, rest.x, glide);
    let y = mix(start.y, rest.y, glide);
    let size = mix(start.size, rest.size, glide);
    let pitch = REST_PITCH - turned * 2;
    let yaw = REST_YAW + turned * 14;
    x = mix(x, middleX, faced);
    y = mix(y, middleY, faced);
    size = mix(size, dive, faced);
    pitch = mix(pitch, 0, faced);
    yaw = mix(yaw, 0, faced);

    const travelling = q < DIVE[1];
    if (travelling) {
      write('art-size', `${size.toFixed(2)}px`, (v) => {
        art.style.width = v;
        art.style.height = v;
      });
      write('art', `translate3d(${(x - size / 2).toFixed(2)}px, ${(y - size / 2).toFixed(2)}px, 0)`, (v) => {
        art.style.transform = v;
      });
      style(layer, '--tilt', `${(pitch - REST_PITCH).toFixed(2)}deg`);
      style(layer, '--turn', `${(yaw - REST_YAW).toFixed(2)}deg`);
      style(layer, '--lean', (1 - faced).toFixed(3));
    }
    layer.toggleAttribute('data-hidden', !travelling);

    // ---- The values: each rises from behind its mask; the newest is lit,
    // the others dimmed, until all three are lit together and lift away.
    const together = ease(STATEMENT, STATEMENT + 0.03, q);
    values.forEach((value, index) => {
      const next = index < VALUES.length - 1 ? risen[index + 1] : 0;
      const opacity = mix(1, 0.26, next * (1 - together));
      style(value, 'transform', `translate3d(0, ${((1 - risen[index]) * 105).toFixed(2)}%, 0)`, `value-t${index}`);
      style(value, 'opacity', opacity.toFixed(3), `value-o${index}`);
    });
    const lift = ease(LIFT[0], LIFT[1], q);
    style(heading, 'transform', `translate3d(0, ${(-lift * 6).toFixed(2)}vh, 0)`, 'heading-t');
    style(heading, 'opacity', (1 - lift).toFixed(3), 'heading-o');

    // ---- The dive, in vectors: from the logo's middle towards its ink. The
    // vector copy fades in over the glass logo just before it takes over.
    const inScene = ease(DIVE[2] - 0.035, DIVE[2], q);
    const diving = q >= DIVE[1] - HANDOVER && inScene < 1;
    shown(lens, diving, 'lens');
    style(lens, 'opacity', ease(DIVE[1] - HANDOVER, DIVE[1], q).toFixed(3), 'lens-o');
    if (diving) {
      const ink = root.dataset.theme === 'dark' ? INK.dark : INK.light;
      const deep = (Math.hypot(width, stageHeight) / 2 / ink.reach) * 1.2;
      const scale = zoom((dive * depth) / 1290, deep, ease(DIVE[1], DIVE[2], q));
      const aim = ease(DIVE[1], DIVE[1] + 0.06, q);
      const focusX = mix(645, ink.x, aim);
      const focusY = mix(645, ink.y, aim);
      write(
        'lens',
        `translate(${middleX.toFixed(2)} ${middleY.toFixed(2)}) scale(${scale.toFixed(5)}) translate(${(-focusX).toFixed(2)} ${(-focusY).toFixed(2)})`,
        (v) => lensLogo.setAttribute('transform', v),
      );
    }

    // ---- The scene: the ink, then the sun and the motto, then the iris.
    const closing = ease(IRIS[0], IRIS[1], q);
    const radius = mix(cover, 0, closing);
    const inView = inScene > 0 && q < IRIS[1];
    shown(scene, inView, 'scene');
    style(scene, 'opacity', inScene.toFixed(3), 'scene-o');
    style(scene, 'clip-path', closing > 0 ? `circle(${radius.toFixed(1)}px at ${sunAt.x.toFixed(1)}px ${sunAt.y.toFixed(1)}px)` : '', 'scene-clip');
    shown(motto, q >= IRIS[0] - 0.02, 'motto');

    // The sun rises from below to the middle, large, then comes to rest.
    const up = ease(SUN[0], SUN[1], q);
    const settle = ease(SUN[1], SUN[2], q);
    const large = (Math.min(width, stageHeight) * 0.42) / sunAt.size;
    const sunX = mix(middleX, sunAt.x, settle);
    const sunY = mix(mix(stageHeight + (sunAt.size * large) / 2, middleY, up), sunAt.y, settle);
    const sunScale = zoom(large, 1, settle);
    const spin = q * 160;
    style(
      sunrise,
      'transform',
      `translate3d(${(sunX - sunAt.x).toFixed(2)}px, ${(sunY - sunAt.y).toFixed(2)}px, 0) scale(${sunScale.toFixed(4)}) rotate(${spin.toFixed(2)}deg)`,
      'sunrise',
    );
    style(sun, 'transform', `rotate(${spin.toFixed(2)}deg)`, 'sun');

    words.forEach((word, index) => {
      const at = mix(WORDS[0], WORDS[1] - 0.04, index / Math.max(1, words.length - 1));
      const rise = ease(at, at + 0.04, q);
      style(word, 'transform', `translate3d(0, ${((1 - rise) * 105).toFixed(2)}%, 0)`, `word${index}`);
    });
    if (translation) {
      const rise = ease(TRANSLATION[0], TRANSLATION[1], q);
      style(translation, 'transform', `translate3d(0, ${((1 - rise) * 0.75).toFixed(3)}rem, 0)`, 'translation-t');
      style(translation, 'opacity', (rise * 0.62).toFixed(3), 'translation-o');
    }

    // ---- How far along; and the header, in the scene's colours while it is
    // behind it.
    const along = clamp(q);
    style(progress, 'transform', `scaleX(${along.toFixed(4)})`, 'progress');
    style(progress.parentElement as HTMLElement, 'opacity', q > 0 && q < 1 ? '1' : '0', 'progress-o');
    progress.parentElement?.toggleAttribute('data-inverse', inView && inScene >= 0.5 && radius > stageHeight - sunAt.y);
    header?.toggleAttribute('data-inverse', inView && inScene >= 0.5 && radius > sunAt.y);
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
  root.dataset.story = 'on';
  // The stage's layout changes once the story is on: measure again.
  measure();
  render();

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

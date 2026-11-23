/**
 * Scroll-driven homepage story (Story.astro) and the glass logo's transition into it from the hero
 * (Hero.astro).
 *
 * Once the hero scrolls away, the logo stays on screen beside the story's values while the stage is
 * pinned:
 *
 * 1. The values flip in one by one; the logo rotates a step with each.
 * 2. The values exit; the logo centers, faces the viewer, and the camera dollies through the front
 *    pane while the block's layers spread apart in perspective.
 * 3. The logo's ink expands into an inverted-theme scene where the glass sun (GlassSun.astro) rises
 *    and settles, and the motto reveals word by word.
 * 4. The scene irises closed around the sun, leaving the sun and motto in the page theme; the stage
 *    unpins.
 *
 * Every frame is a pure function of scroll position, so scrolling back reverses it. Layout is
 * measured on load and resize only; per-frame updates set transforms, opacity, custom properties
 * and a clip path through the CSSOM (CSP-safe).
 *
 * Rendering: everything animates with compositor-only transforms. From the moment the logo faces
 * the viewer it is laid out once at that size (and the sun once at its largest) and only translated
 * and scaled afterwards, with the perspective shortened proportionally, which is visually identical
 * to a larger layout. Nothing reflows during the sequence, so there is no layout shift. Layers keep
 * `will-change` and are re-rasterized (`redraw`) only when their on-screen scale crosses a sqrt(2)
 * step (`rung`), so each texture stays within 1.41x of its display size. Edge layers are culled
 * once the logo faces the viewer; twenty full-screen translucent layers would make the fly-in
 * stutter.
 *
 * theme-init.js reserves space for the story (`data-story`) before first paint when motion is
 * allowed; this module activates it. Without JS or with reduced motion, the story is a static
 * section and the logo stays in the hero.
 */

import { clamp, mix, smoothstep } from '../utils/math';

/** Geometric interpolation, so each scroll step scales by the same factor. */
const zoom = (from: number, to: number, t: number) => from * (to / from) ** t;

/**
 * Index of `size` on a ladder of sqrt(2) steps around `base`. A layer is re-rasterized only when it
 * moves to another rung, so it is never scaled more than 1.41x from its raster size.
 */
const rung = (base: number, size: number) => Math.round(2 * Math.log2(size / base));

/** Rest pose, matching LiftedLogo.astro. */
const REST_PITCH = 12;
const REST_YAW = -18;

/** The logo sits 45% of the way into a glass block 7% of its width deep. */
const LOGO_DEPTH = 0.45 * 0.07;

/* Timeline, as fractions of the pinned scroll range. */
/** Start of each value's flip-in, and its duration. */
const VALUES = [-0.02, 0.1, 0.21];
const RISE = 0.07;
/** All three values highlighted together, then exiting. */
const STATEMENT = 0.31;
const LIFT = [0.38, 0.44];
/** Logo centers and faces the viewer; camera dollies into the ink; the ink becomes the scene. */
const DIVE = [0.38, 0.46, 0.58];
/** Sun rises to center, then settles above the motto. */
const SUN = [0.57, 0.69, 0.77];
/** Motto reveals word by word, then its translation. */
const WORDS = [0.71, 0.8];
const TRANSLATION = [0.77, 0.82];
/** Scene irises closed around the sun. */
const IRIS = [0.84, 0.97];

/**
 * Camera target in the logo's 1290-unit tile: the point deepest inside its ink (smoked shapes in
 * light mode, frosted in dark), and the ink's extent around it. Precomputed with a distance
 * transform.
 */
const INK = {
  light: { x: 762, y: 786, reach: 143 },
  dark: { x: 1020, y: 1020, reach: 187 },
};

/** Element offset from layout only (ignores transforms). */
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

  const find = (selector: string) => story.querySelector<HTMLElement>(selector);
  const slot = find('[data-story-slot]');
  const heading = find('.story__values');
  const values = [...story.querySelectorAll<HTMLElement>('[data-story-value] > span')];
  const motto = find('[data-story-motto]');
  const sun = find('[data-story-sun]');
  const scene = find('[data-story-scene]');
  const sunrise = find('[data-story-sunrise]');
  // The rotating sun body and the specular band across its face.
  const sunBody = sunrise?.querySelector<HTMLElement>('.glass-sun__body');
  const band = sunrise?.querySelector<SVGElement>('.glass-sun__band');
  const glow = find('[data-story-glow]');
  const words = [...story.querySelectorAll<HTMLElement>('[data-story-word]')];
  const translation = find('[data-story-translation]');
  const progress = find('[data-story-progress]');
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!slot || !heading || !motto || !sun || !scene || !sunrise || !sunBody || !band || !glow || !progress) return;

  // The traveling copy is decorative; the original keeps the accessible label.
  const copy = logo.cloneNode(true) as HTMLElement;
  copy.removeAttribute('role');
  copy.removeAttribute('aria-label');
  copy.setAttribute('aria-hidden', 'true');
  tilt.append(copy);

  // Measurements: viewport, the logo's hero position, the story's start and pinned length, and the
  // logo and sun targets on the stage. The stage fills the large viewport even when mobile browser
  // chrome collapses; its content stays within the small viewport (`view`).
  let width = 0;
  let stageHeight = 0;
  let view = 0;
  // Perspectives as authored in CSS, read before this module overrides them.
  const perspective = parseFloat(getComputedStyle(art).perspective) || 1280;
  const sunPerspective = parseFloat(getComputedStyle(sunrise).perspective) || 960;
  let start = { x: 0, y: 0, size: 1 };
  /**
   * Scroll offset at which the hero reaches the top (below the header); the logo starts traveling
   * there.
   */
  let heroTop = 0;
  let storyTop = 0;
  let pinned = 1;
  let rest = { x: 0, y: 0, size: 1 };
  let sunAt = { x: 0, y: 0, size: 1 };
  let dive = 1;
  let cover = 1;
  let large = 1;
  // Layout key from the last measure, to detect resizes that change it.
  let measuredAs = '';

  const measure = () => {
    width = root.clientWidth;
    const hero = place(from);
    const top = place(stage);
    const spot = place(slot);
    const disc = place(sun);
    stageHeight = stage.offsetHeight;
    view = stage.clientHeight - parseFloat(getComputedStyle(stage).paddingBottom);
    start = { x: hero.x + hero.width / 2, y: hero.y + hero.width / 2, size: hero.width };
    const header = document.querySelector<HTMLElement>('[data-site-header]')?.offsetHeight ?? 0;
    heroTop = Math.max(0, place(from.closest<HTMLElement>('.hero') ?? from).y - header);
    storyTop = place(story).y;
    pinned = Math.max(1, story.offsetHeight - stageHeight);
    rest = { x: spot.x - top.x + spot.width / 2, y: spot.y - top.y + spot.width / 2, size: spot.width || hero.width };
    sunAt = { x: disc.x - top.x + disc.width / 2, y: disc.y - top.y + disc.height / 2, size: disc.width };
    // Facing the viewer, the logo fills most of the shorter viewport side (and never shrinks to get
    // there); the scene's circle starts large enough to cover the stage.
    dive = Math.max(rest.size * 1.15, Math.min(width, view) * 0.62);
    cover = Math.hypot(Math.max(sunAt.x, width - sunAt.x), Math.max(sunAt.y, stageHeight - sunAt.y)) + 2;
    // Sun size at its largest, while rising.
    large = Math.min(width, view) * 0.44;
    // Mobile browser chrome collapsing or expanding resizes the window without changing these
    // values (the stage is sized for it), so keep the current rasters instead of redrawing as the
    // user changes scroll direction.
    const as = [width, stageHeight, view, heroTop, storyTop, pinned, start.x, start.y, start.size, rest.x, rest.y, rest.size, sunAt.x, sunAt.y, sunAt.size]
      .map((value) => value.toFixed(1))
      .join();
    if (as === measuredAs) return;
    measuredAs = as;
    written.clear();
    // Lay the sun out once, at its largest; afterwards it is only translated and scaled.
    style(sunrise, 'width', `${large.toFixed(2)}px`, 'sun-w');
    drawn.clear();
  };

  /** Scale at which the logo's ink covers the viewport, accounting for perspective. */
  const deepest = (reach: number) => {
    const needed = ((Math.hypot(width, stageHeight) / 2) * 1.15 * 1290) / reach;
    const room = perspective - LOGO_DEPTH * needed;
    return room > perspective * 0.1 ? (needed * perspective) / room : needed * 10;
  };

  const written = new Map<string, string>();
  const style = (element: HTMLElement | SVGElement, name: string, value: string, key = name) => {
    if (written.get(key) === value) return;
    written.set(key, value);
    element.style.setProperty(name, value);
  };
  const shown = (element: HTMLElement, visible: boolean, key: string) =>
    style(element, 'visibility', visible ? 'visible' : '', key);

  // Last rung each layer was rasterized at. On a rung change (or first sight), `will-change` is
  // dropped for one frame so the compositor re-rasterizes at the current size, then restored for
  // the motion.
  const drawn = new Map<HTMLElement, number>();
  const redraw = (element: HTMLElement, at: number) => {
    if (drawn.get(element) === at) return;
    drawn.set(element, at);
    element.style.willChange = 'auto';
    requestAnimationFrame(() => element.style.removeProperty('will-change'));
  };

  const render = () => {
    const scroll = Math.max(0, window.scrollY);
    const q = (scroll - storyTop) / pinned;
    const middleX = width / 2;
    const middleY = view / 2;

    // --- Glass logo ---
    // Hero -> beside the values -> center -> dive. If content precedes the hero, the logo scrolls
    // up with it until the hero reaches the top.
    const glide = smoothstep(heroTop, storyTop, scroll);
    const risen = VALUES.map((at) => smoothstep(at, at + RISE, q));
    const turned = risen.reduce((sum, value) => sum + value, 0);
    const faced = smoothstep(DIVE[0], DIVE[1], q);
    const flight = smoothstep(DIVE[1], DIVE[2], q);

    let x = mix(start.x, rest.x, glide);
    let y = mix(start.y - Math.min(scroll, heroTop), rest.y, glide);
    let size = mix(start.size, rest.size, glide);
    let pitch = REST_PITCH - turned * 2;
    let yaw = REST_YAW + turned * 14;
    x = mix(x, middleX, faced);
    y = mix(y, middleY, faced);
    size = mix(size, dive, faced);
    pitch = mix(pitch, 0, faced);
    yaw = mix(yaw, 0, faced);

    // Dolly: scale the logo while keeping the camera target centered. The target lies on the logo
    // plane, which perspective renders smaller than the block's front face as the block grows.
    if (q > DIVE[1]) {
      const ink = root.dataset.theme === 'dark' ? INK.dark : INK.light;
      const aim = smoothstep(DIVE[1], DIVE[1] + 0.05, q);
      const aimX = mix(0.5, ink.x / 1290, aim);
      const aimY = mix(0.5, ink.y / 1290, aim);
      size = zoom(dive, deepest(ink.reach), flight);
      const seen = perspective / (perspective + LOGO_DEPTH * size);
      x = middleX - seen * (aimX - 0.5) * size;
      y = middleY - seen * (aimY - 0.5) * size;
    }

    // Progress through the front pane, which slides past the camera.
    const through = smoothstep(DIVE[1], DIVE[1] + 0.05, q);
    const inScene = smoothstep(DIVE[2] - 0.04, DIVE[2], q);
    const travelling = inScene < 1;
    // While rotating, lay out at the current size; once facing the viewer, lay out at the facing
    // size and scale from there with proportionally shorter perspective (see the header). Pixel
    // sizes inside the logo (edge lines, lean) are multiplied by the same factor so they render
    // unchanged when scaled.
    const facing = q >= DIVE[0];
    const box = facing ? dive : size;
    if (travelling) {
      style(art, 'width', `${box.toFixed(2)}px`, 'art-w');
      style(art, 'height', `${box.toFixed(2)}px`, 'art-h');
      style(art, '--grow', facing ? (dive / rest.size).toFixed(4) : '1', 'art-grow');
      if (facing) redraw(art, rung(dive, size));
      else drawn.delete(art);
      style(art, 'perspective', `${((perspective * box) / size).toFixed(1)}px`, 'art-p');
      style(
        art,
        'transform',
        `translate3d(${(x - box / 2).toFixed(2)}px, ${(y - box / 2).toFixed(2)}px, 0) scale(${(size / box).toFixed(4)})`,
        'art-t',
      );
      style(layer, '--tilt', `${(pitch - REST_PITCH).toFixed(2)}deg`);
      style(layer, '--turn', `${(yaw - REST_YAW).toFixed(2)}deg`);
      style(layer, '--lean', (1 - faced).toFixed(3));
      // Front pane slides past as the camera passes through.
      style(layer, '--front', (1 - through).toFixed(3));
    }
    layer.toggleAttribute('data-hidden', !travelling);
    layer.toggleAttribute('data-facing', facing && travelling);
    // Face-on, the block edge is invisible: skip drawing it, and the front pane once the camera is
    // through.
    layer.toggleAttribute('data-flat', faced > 0.5);
    layer.toggleAttribute('data-through', through === 1);

    // --- Values ---
    // Each flips in from behind its mask; the newest is highlighted and the others dimmed, until
    // all three highlight together and exit.
    const together = smoothstep(STATEMENT, STATEMENT + 0.03, q);
    values.forEach((value, index) => {
      const next = index < VALUES.length - 1 ? risen[index + 1] : 0;
      const opacity = mix(1, 0.26, next * (1 - together));
      const down = 1 - risen[index];
      style(value, 'transform', `translate3d(0, ${(down * 100).toFixed(2)}%, 0) rotateX(${(down * -70).toFixed(2)}deg)`, `value-t${index}`);
      style(value, 'opacity', opacity.toFixed(3), `value-o${index}`);
    });
    const lift = smoothstep(LIFT[0], LIFT[1], q);
    style(heading, 'transform', `translate3d(0, ${(-lift * 6).toFixed(2)}vh, 0)`, 'heading-t');
    style(heading, 'opacity', (1 - lift).toFixed(3), 'heading-o');

    // --- Scene: the ink, then the sun and motto, then the iris. ---
    const closing = smoothstep(IRIS[0], IRIS[1], q);
    const radius = mix(cover, 0, closing);
    const inView = inScene > 0 && q < IRIS[1];
    shown(scene, inView, 'scene');
    style(scene, 'opacity', inScene.toFixed(3), 'scene-o');
    style(scene, 'clip-path', closing > 0 ? `circle(${radius.toFixed(1)}px at ${sunAt.x.toFixed(1)}px ${sunAt.y.toFixed(1)}px)` : '', 'scene-clip');
    shown(motto, q >= IRIS[0] - 0.02, 'motto');

    // The glass sun rises from below, large and tumbling, to center, then settles facing the viewer
    // above the motto, rotating with scroll like the motto's own sun.
    const up = smoothstep(SUN[0], SUN[1], q);
    const settle = smoothstep(SUN[1], SUN[2], q);
    const sunSize = zoom(large, sunAt.size, settle);
    const sunBox = large;
    if (inView) redraw(sunrise, rung(large, sunSize));
    const sunX = mix(middleX, sunAt.x, settle);
    const sunY = mix(mix(stageHeight + large / 2, middleY, up), sunAt.y, settle);
    const spin = q * 160;
    const tumble = 1 - settle;
    style(sunrise, 'perspective', `${((sunPerspective * sunBox) / sunSize).toFixed(1)}px`, 'sun-p');
    style(
      sunrise,
      'transform',
      `translate3d(${(sunX - sunAt.x).toFixed(2)}px, ${(sunY - sunAt.y).toFixed(2)}px, 0) scale(${(sunSize / sunBox).toFixed(4)})`,
      'sun-t',
    );
    // Set directly on the moving elements rather than as inherited custom properties: the sun's
    // vector layers would inherit them and repaint every frame.
    style(
      sunBody,
      'transform',
      `rotateX(${(tumble * mix(48, 14, up)).toFixed(2)}deg) rotateY(${(tumble * mix(-220, -24, up)).toFixed(2)}deg) rotateZ(${spin.toFixed(2)}deg)`,
      'sun-pose',
    );
    // Specular glint sweeps across the face as the sun settles: the strip is 3x the sun's width and
    // travels 2x that width (400 of the sun's 200 units), from just past one edge to the other.
    style(band, 'transform', `translateX(${(mix(1.1, -0.1, smoothstep(SUN[0], SUN[2], q)) * -400).toFixed(2)}px)`, 'sun-glint');
    style(sun, 'transform', `rotate(${spin.toFixed(2)}deg)`, 'sun');

    // Soft back light, strongest as the sun reaches center.
    const light = up * (1 - 0.6 * settle);
    style(glow, 'transform', `translate3d(${(sunX - sunAt.x).toFixed(2)}px, ${(sunY - sunAt.y).toFixed(2)}px, 0) scale(${((sunSize / sunAt.size) * 0.9).toFixed(3)})`, 'glow-t');
    style(glow, 'opacity', light.toFixed(3), 'glow-o');

    words.forEach((word, index) => {
      const at = mix(WORDS[0], WORDS[1] - 0.04, index / Math.max(1, words.length - 1));
      const rise = smoothstep(at, at + 0.04, q);
      style(word, 'transform', `translate3d(0, ${((1 - rise) * 130).toFixed(2)}%, 0)`, `word${index}`);
    });
    if (translation) {
      const rise = smoothstep(TRANSLATION[0], TRANSLATION[1], q);
      style(translation, 'transform', `translate3d(0, ${((1 - rise) * 0.75).toFixed(3)}rem, 0)`, 'translation-t');
      style(translation, 'opacity', (rise * 0.62).toFixed(3), 'translation-o');
    }

    // --- Progress bar, and the header in the scene's colors while the scene is behind it. ---
    const bar = progress.parentElement as HTMLElement;
    style(progress, 'transform', `scaleX(${clamp(q).toFixed(4)})`, 'progress');
    style(bar, 'opacity', q > 0 && q < 1 ? '1' : '0', 'progress-o');
    bar.toggleAttribute('data-inverse', inView && inScene >= 0.5 && radius > view - sunAt.y);
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
  // Activating the story changes the stage layout: measure again.
  measure();
  render();

  // Re-measure when fonts load or the viewport resizes.
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

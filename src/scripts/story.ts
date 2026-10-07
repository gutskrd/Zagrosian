/**
 * The homepage walkthrough (Story.astro), and the glass logo's way into it
 * from the hero (Hero.astro). It is all glass and all 3D.
 *
 * As the hero scrolls away, the glass logo stays on the screen and settles
 * beside the story's values, which the page pins in place. Then, as the page
 * scrolls on:
 *
 * 1. The values flip up one by one, and the logo turns a notch with each.
 * 2. The values lift away; the logo comes to the middle, faces the reader and
 *    the camera flies into the glass: the front pane slides past and fades,
 *    and the block's layers spread apart in perspective as the camera nears
 *    the logo's ink.
 * 3. The ink becomes a scene in the other theme's colours, where the Kurdish
 *    sun rises as a thick piece of glass (GlassSun.astro), tumbling and
 *    catching the light, with a glow behind it; it comes to rest facing the
 *    reader, and the motto rises under it, word by word.
 * 4. The scene closes into the sun like an iris, and leaves the sun and the
 *    motto in the page's own colours. The stage lets go and they scroll on.
 *
 * Scrolling back plays it all backwards. Everything is a function of the
 * scroll position: the page is measured on load and resize only, and each
 * frame sets transforms, opacity, custom properties and a clip path through
 * the CSSOM (which the Content-Security-Policy allows).
 *
 * So that nothing lags, the graphics card does the moving. Turned in 3D, the
 * logo is laid out at the size it is seen at (a drawing in perspective is
 * drawn at its layout's size). From when it turns to face the reader, it is
 * laid out once, at its size facing the reader, and the sun once, at its
 * largest; from there they are only moved and scaled, the perspective
 * shortening as they grow, which gives exactly the picture a larger logo would
 * (a scene and its camera distance scaled together look the same). So their
 * layout does not change as the camera flies in or the sun settles, and
 * nothing on the page shifts (which search engines would count against it).
 * The graphics card keeps each drawing as it is while it moves
 * (`will-change`), and draws it again, sharp, at the size it is seen at only
 * when that size has grown or shrunk by half a doubling since (`redraw`, on
 * the ladder of `rung` below). Each is therefore always drawn within 1.4
 * times the size it is seen at, scrolling down or up: neither blurred by being
 * scaled up far, nor holding on to a drawing much larger than it is seen at
 * (which would take graphics memory and time to put on the screen). And once the
 * logo faces the reader, the layers that make its edge are not drawn: face
 * on, the edge cannot be seen, and twenty see-through layers the size of the
 * screen are what would make the fly-in stutter.
 *
 * theme-init.js makes room for the walkthrough (`data-story`) before the first
 * paint when motion is welcome; this script turns it on. Without JavaScript or
 * with reduced motion, the story is a plain section and the logo stays in the
 * hero.
 */

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/** Between two sizes, so that each step of the scroll grows by the same factor. */
const zoom = (from: number, to: number, t: number) => from * (to / from) ** t;

/**
 * The rung `size` is on, of a ladder of half doublings (1.41 times) above and
 * below `base`. A drawing is drawn again only when its size moves to another
 * rung, so it is never scaled by more than 1.41 from where it was drawn.
 */
const rung = (base: number, size: number) => Math.round(2 * Math.log2(size / base));

/** 0 to 1 between two points, easing in and out. */
const ease = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** The logo's pose at rest, as LiftedLogo.astro draws it. */
const REST_PITCH = 12;
const REST_YAW = -18;

/** In the glass block, the logo sits 45% of the way through a depth 7% of its width. */
const LOGO_DEPTH = 0.45 * 0.07;

/* Where each chapter sits along the pinned scroll, from 0 to 1. */
/** When each value starts to flip up, and how long it takes. */
const VALUES = [-0.02, 0.1, 0.21];
const RISE = 0.07;
/** All three lit together, then lifting away. */
const STATEMENT = 0.31;
const LIFT = [0.38, 0.44];
/** The logo comes to the middle and faces the reader; the camera flies into its ink; the ink becomes the scene. */
const DIVE = [0.38, 0.46, 0.58];
/** The sun rises to the middle, then comes to rest above the motto. */
const SUN = [0.57, 0.69, 0.77];
/** The motto rises word by word; then its translation. */
const WORDS = [0.71, 0.8];
const TRANSLATION = [0.77, 0.82];
/** The scene closes into the sun. */
const IRIS = [0.84, 0.97];

/**
 * Where the camera flies in, in the logo's 1290-unit tile: the deepest point
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

  const find = (selector: string) => story.querySelector<HTMLElement>(selector);
  const slot = find('[data-story-slot]');
  const heading = find('.story__values');
  const values = [...story.querySelectorAll<HTMLElement>('[data-story-value] > span')];
  const motto = find('[data-story-motto]');
  const sun = find('[data-story-sun]');
  const scene = find('[data-story-scene]');
  const sunrise = find('[data-story-sunrise]');
  // The glass sun's body, which turns, and the band of light across its face.
  const sunBody = sunrise?.querySelector<HTMLElement>('.glass-sun__body');
  const band = sunrise?.querySelector<SVGElement>('.glass-sun__band');
  const glow = find('[data-story-glow]');
  const words = [...story.querySelectorAll<HTMLElement>('[data-story-word]')];
  const translation = find('[data-story-translation]');
  const progress = find('[data-story-progress]');
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!slot || !heading || !motto || !sun || !scene || !sunrise || !sunBody || !band || !glow || !progress) return;

  // The copy of the logo that travels: decoration, as the original keeps the label.
  const copy = logo.cloneNode(true) as HTMLElement;
  copy.removeAttribute('role');
  copy.removeAttribute('aria-label');
  copy.setAttribute('aria-hidden', 'true');
  tilt.append(copy);

  // The page, measured: the screen; the logo's place in the hero; where the
  // story starts and how long it stays pinned; and, on the stage, the logo's
  // place beside the values and the sun's place above the motto. The stage
  // fills the screen even when a phone's address bar slides away; its content
  // keeps to the part the bar never covers (`view`).
  let width = 0;
  let stageHeight = 0;
  let view = 0;
  // The perspectives as the CSS sets them, read before this script changes them.
  const perspective = parseFloat(getComputedStyle(art).perspective) || 1280;
  const sunPerspective = parseFloat(getComputedStyle(sunrise).perspective) || 960;
  let start = { x: 0, y: 0, size: 1 };
  let storyTop = 0;
  let pinned = 1;
  let rest = { x: 0, y: 0, size: 1 };
  let sunAt = { x: 0, y: 0, size: 1 };
  let dive = 1;
  let cover = 1;
  let large = 1;
  // What the story was last laid out by, to tell a resize that changes it.
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
    storyTop = place(story).y;
    pinned = Math.max(1, story.offsetHeight - stageHeight);
    rest = { x: spot.x - top.x + spot.width / 2, y: spot.y - top.y + spot.width / 2, size: spot.width || hero.width };
    sunAt = { x: disc.x - top.x + disc.width / 2, y: disc.y - top.y + disc.height / 2, size: disc.width };
    // Faced, the logo fills most of the shorter side of the screen (and never
    // shrinks to get there); the scene's circle starts out large enough to
    // cover the whole stage.
    dive = Math.max(rest.size * 1.15, Math.min(width, view) * 0.62);
    cover = Math.hypot(Math.max(sunAt.x, width - sunAt.x), Math.max(sunAt.y, stageHeight - sunAt.y)) + 2;
    // The sun at its largest, as it rises.
    large = Math.min(width, view) * 0.44;
    // A phone's address bar, sliding away as the page scrolls down and back
    // as it scrolls up, resizes the window without changing any of this (the
    // stage is sized to stay put): then the drawings are kept, as they are,
    // rather than drawn again just as the reader turns round.
    const as = [width, stageHeight, view, storyTop, pinned, start.x, start.y, start.size, rest.x, rest.y, rest.size, sunAt.x, sunAt.y, sunAt.size]
      .map((value) => value.toFixed(1))
      .join();
    if (as === measuredAs) return;
    measuredAs = as;
    written.clear();
    // The sun is laid out once, at its largest, and only moved and scaled.
    style(sunrise, 'width', `${large.toFixed(2)}px`, 'sun-w');
    drawn.clear();
  };

  /** How large the logo must grow for its ink to cover the screen, seen in perspective. */
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

  // Which rung of its ladder each drawing was last drawn at. Moving to another
  // (or first seen), it lets go of `will-change` for one frame, so the
  // graphics card draws it again at the size it is seen at, then holds that
  // drawing while it moves.
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

    // ---- The glass logo: down from the hero, beside the values, to the
    // middle, and in.
    const glide = ease(0, storyTop, scroll);
    const risen = VALUES.map((at) => ease(at, at + RISE, q));
    const turned = risen.reduce((sum, value) => sum + value, 0);
    const faced = ease(DIVE[0], DIVE[1], q);
    const flight = ease(DIVE[1], DIVE[2], q);

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

    // The flight in: the logo grows, keeping the point the camera aims at in
    // the middle of the screen. That point is on the logo's own plane, which
    // perspective shows smaller than the block as the block grows deeper.
    if (q > DIVE[1]) {
      const ink = root.dataset.theme === 'dark' ? INK.dark : INK.light;
      const aim = ease(DIVE[1], DIVE[1] + 0.05, q);
      const aimX = mix(0.5, ink.x / 1290, aim);
      const aimY = mix(0.5, ink.y / 1290, aim);
      size = zoom(dive, deepest(ink.reach), flight);
      const seen = perspective / (perspective + LOGO_DEPTH * size);
      x = middleX - seen * (aimX - 0.5) * size;
      y = middleY - seen * (aimY - 0.5) * size;
    }

    // How far the camera has gone through the front pane, which slides past.
    const through = ease(DIVE[1], DIVE[1] + 0.05, q);
    const inScene = ease(DIVE[2] - 0.04, DIVE[2], q);
    const travelling = inScene < 1;
    // Laid out at its size while it is turned; from when it turns to face the
    // reader, at its size facing the reader, and scaled from there, with a
    // perspective as much shorter as it is larger (see above). Its few sizes
    // in pixels (its edge's lines, its lean) are then as many times larger as
    // its layout is than it was, so that scaled, they are as they were.
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
      // The front pane slides past as the camera goes through it.
      style(layer, '--front', (1 - through).toFixed(3));
    }
    layer.toggleAttribute('data-hidden', !travelling);
    layer.toggleAttribute('data-facing', facing && travelling);
    // Face on, the block's edge cannot be seen: it is not drawn; nor is the
    // front pane, once the camera is through it.
    layer.toggleAttribute('data-flat', faced > 0.5);
    layer.toggleAttribute('data-through', through === 1);

    // ---- The values: each flips up from behind its mask; the newest is lit,
    // the others dimmed, until all three are lit together and lift away.
    const together = ease(STATEMENT, STATEMENT + 0.03, q);
    values.forEach((value, index) => {
      const next = index < VALUES.length - 1 ? risen[index + 1] : 0;
      const opacity = mix(1, 0.26, next * (1 - together));
      const down = 1 - risen[index];
      style(value, 'transform', `translate3d(0, ${(down * 100).toFixed(2)}%, 0) rotateX(${(down * -70).toFixed(2)}deg)`, `value-t${index}`);
      style(value, 'opacity', opacity.toFixed(3), `value-o${index}`);
    });
    const lift = ease(LIFT[0], LIFT[1], q);
    style(heading, 'transform', `translate3d(0, ${(-lift * 6).toFixed(2)}vh, 0)`, 'heading-t');
    style(heading, 'opacity', (1 - lift).toFixed(3), 'heading-o');

    // ---- The scene: the ink, then the sun and the motto, then the iris.
    const closing = ease(IRIS[0], IRIS[1], q);
    const radius = mix(cover, 0, closing);
    const inView = inScene > 0 && q < IRIS[1];
    shown(scene, inView, 'scene');
    style(scene, 'opacity', inScene.toFixed(3), 'scene-o');
    style(scene, 'clip-path', closing > 0 ? `circle(${radius.toFixed(1)}px at ${sunAt.x.toFixed(1)}px ${sunAt.y.toFixed(1)}px)` : '', 'scene-clip');
    shown(motto, q >= IRIS[0] - 0.02, 'motto');

    // The glass sun rises from below, large and tumbling, to the middle, then
    // comes to rest facing the reader above the motto, turning as the page
    // scrolls, as the motto's own sun does.
    const up = ease(SUN[0], SUN[1], q);
    const settle = ease(SUN[1], SUN[2], q);
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
    // Set on the parts that move, not as custom properties round them: the
    // sun's vector layers would inherit those, and be drawn again every frame.
    style(
      sunBody,
      'transform',
      `rotateX(${(tumble * mix(48, 14, up)).toFixed(2)}deg) rotateY(${(tumble * mix(-220, -24, up)).toFixed(2)}deg) rotateZ(${spin.toFixed(2)}deg)`,
      'sun-pose',
    );
    // The glint slides across the face as the sun comes to rest: its strip,
    // three times the sun's width, moves by twice the sun's width (400 units of
    // the sun's 200), from just past the face on one side to the other.
    style(band, 'transform', `translateX(${(mix(1.1, -0.1, ease(SUN[0], SUN[2], q)) * -400).toFixed(2)}px)`, 'sun-glint');
    style(sun, 'transform', `rotate(${spin.toFixed(2)}deg)`, 'sun');

    // A soft light behind the sun, brightest as it reaches the middle.
    const light = up * (1 - 0.6 * settle);
    style(glow, 'transform', `translate3d(${(sunX - sunAt.x).toFixed(2)}px, ${(sunY - sunAt.y).toFixed(2)}px, 0) scale(${((sunSize / sunAt.size) * 0.9).toFixed(3)})`, 'glow-t');
    style(glow, 'opacity', light.toFixed(3), 'glow-o');

    words.forEach((word, index) => {
      const at = mix(WORDS[0], WORDS[1] - 0.04, index / Math.max(1, words.length - 1));
      const rise = ease(at, at + 0.04, q);
      style(word, 'transform', `translate3d(0, ${((1 - rise) * 130).toFixed(2)}%, 0)`, `word${index}`);
    });
    if (translation) {
      const rise = ease(TRANSLATION[0], TRANSLATION[1], q);
      style(translation, 'transform', `translate3d(0, ${((1 - rise) * 0.75).toFixed(3)}rem, 0)`, 'translation-t');
      style(translation, 'opacity', (rise * 0.62).toFixed(3), 'translation-o');
    }

    // ---- How far along; and the header, in the scene's colours while the
    // scene is behind it.
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

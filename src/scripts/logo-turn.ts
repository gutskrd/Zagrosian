/**
 * The glass logo in the hero turns over as the page scrolls
 * (LiftedLogo.astro, inside `[data-logo-turn]`).
 *
 * As the logo rises up the screen, the block leans back, rolls and turns over.
 * On the way it opens up twice, its layers parting and twisting about its
 * middle, first one way and then back; a streak of light slides off one face
 * and onto the other, and the lights behind the glass trade places. It comes to rest sun side up, and the sun grows into place
 * and keeps turning slowly as the logo leaves the screen. Scrolling back plays
 * it all backwards.
 *
 * The pose follows the scroll with a little weight: it eases towards it, and
 * a fast scroll fans the layers out a little further, so the glass feels like
 * a thing with mass.
 *
 * Only custom properties change, through the CSSOM (which the
 * Content-Security-Policy allows), and only while the logo is near the screen;
 * the page's layout is read on load and resize, never while scrolling. Not
 * used when reduced motion is preferred: the logo then rests, logo side up.
 */

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** 0 to 1 between two points, easing in and out. */
const ease = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** 0 to 1 and back to 0 between two points, softly. */
const arc = (from: number, to: number, value: number) => Math.sin(Math.PI * clamp((value - from) / (to - from)));

/** The share of the scroll over which the block turns over; the sun spins through the rest. */
const FLIP = 0.55;

/** How quickly the pose catches up with the scroll, in seconds. */
const WEIGHT = 0.09;

export function initLogoTurn() {
  const frame = document.querySelector<HTMLElement>('[data-logo-turn]');
  if (!frame) return;

  // The middle of the logo on the page, and where on the screen (as a share
  // of its height) the turn starts: where the logo first sits, but no lower
  // than nine tenths of the way down, so on a phone it turns in full view.
  let centre = 0;
  let start = 0.9;

  let target = 0;
  let progress = 0;
  let speed = 0;
  let last = 0;
  let running = false;
  let near = false;
  const written = new Map<string, string>();

  const measure = () => {
    let top = 0;
    for (let element: HTMLElement | null = frame; element; element = element.offsetParent as HTMLElement | null) {
      top += element.offsetTop;
    }
    centre = top + frame.offsetHeight / 2;
    start = clamp(centre / window.innerHeight, 0.25, 0.9);
  };

  // 0 where the turn starts, 1 once the logo's middle reaches the top of the screen.
  const read = () => clamp((start - (centre - window.scrollY) / window.innerHeight) / start);

  const set = (name: string, value: string) => {
    if (written.get(name) === value) return;
    written.set(name, value);
    frame.style.setProperty(name, value);
  };

  const render = () => {
    const p = progress;
    const turned = ease(0, FLIP, p);
    const swing = arc(0, FLIP, p);
    const leaving = ease(FLIP, 1, p);
    const sun = ease(FLIP * 0.5, FLIP, p);

    // Twice in the turn the block opens up: its layers part and twist one
    // way as it turns towards its edge, close up into a solid block edge-on,
    // then part and twist back the other way. A fast scroll parts them a
    // little further.
    const wave = Math.sin(2 * Math.PI * turned);
    const rush = clamp((Math.abs(speed) - 0.6) * 0.3, 0, 0.45);
    const fan = clamp(Math.abs(wave) ** 1.3 + rush);

    set('--turn', `${(turned * 180 + leaving * 10).toFixed(2)}deg`);
    set('--tilt', `${(swing * -16 + leaving * 6).toFixed(2)}deg`);
    set('--roll', `${(swing * 10).toFixed(2)}deg`);
    set('--lift', (1 + swing * 0.08 - leaving * 0.05).toFixed(4));
    set('--spread', (1 + fan * 2.4).toFixed(4));
    set('--fan', fan.toFixed(3));
    set('--twist', `${(wave * 36 + clamp(speed * 8, -12, 12)).toFixed(2)}deg`);
    set('--sun-size', (0.7 + sun * 0.3).toFixed(4));
    set('--sun-turn', `${((sun - 1) * 90 + leaving * 120).toFixed(2)}deg`);
    set('--glint', `${(turned * -260).toFixed(1)}%`);
    set('--glint-sun', `${((1 - turned) * 260).toFixed(1)}%`);
    set('--turned', turned.toFixed(4));
  };

  const step = (now: number) => {
    const dt = clamp((now - last) / 1000, 1 / 240, 0.05);
    last = now;
    const before = progress;
    progress += (target - progress) * (1 - Math.exp(-dt / WEIGHT));
    speed += ((progress - before) / dt - speed) * (1 - Math.exp(-dt / 0.15));

    if (Math.abs(target - progress) < 0.0005 && Math.abs(speed) < 0.02) {
      progress = target;
      speed = 0;
      running = false;
    } else {
      requestAnimationFrame(step);
    }
    render();
  };

  const wake = () => {
    target = read();
    if (!near || running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(step);
  };

  measure();
  progress = target = read();
  render();

  new IntersectionObserver(
    ([entry]) => {
      near = entry.isIntersecting;
      wake();
    },
    { rootMargin: '20% 0px' },
  ).observe(frame);

  // The logo moves on the page when the text above it reflows (a font
  // arriving, a narrower window): measure again then.
  new ResizeObserver(() => {
    measure();
    wake();
  }).observe(frame.closest('section') ?? document.body);

  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener(
    'resize',
    () => {
      measure();
      wake();
    },
    { passive: true },
  );
}

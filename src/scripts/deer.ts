/**
 * Hevalo's deer, climbing out of a hole in the page (HevaloDeer.astro).
 *
 * Where the reader's eye is: the view through the hole is drawn from it.
 * Across, it is the middle of the screen, measured from the hole; with a
 * mouse, it also moves towards the pointer, eased, as if the reader leaned to
 * look. (Down, the scroll moves it, in CSS.)
 *
 * Life: while it is on screen the deer blinks every few seconds and, less
 * often, twitches an ear or sniffs; when it first comes into view it pricks up
 * both ears and blinks, as if it had seen you; a tap or a click on it gets all
 * of that at once (and the tap sound, when sound is on). Each is a short CSS
 * animation, started by an attribute on the deer and removed when it is over,
 * so nothing runs in between.
 *
 * Nothing moves off screen, in a background tab, or when the visitor prefers
 * reduced motion. Its eyes are eyes.ts.
 */
import { play } from './sound';

type Act = 'blink' | 'twitch' | 'sniff';

/** How long each lasts (ms), as in HevaloDeer.astro. */
const LENGTH: Record<Act, number> = { blink: 260, twitch: 700, sniff: 800 };

const between = (min: number, max: number) => min + Math.random() * (max - min);

/** The eye across: the middle of the screen, from the hole's left edge. */
function placeEye(deer: HTMLElement) {
  const place = () => {
    const rect = deer.getBoundingClientRect();
    // Never more than 500 px to the side of the hole: further, the view
    // through it would reach past the page drawn round it.
    const centre = rect.width / 2;
    const x = Math.min(centre + 500, Math.max(centre - 500, window.innerWidth / 2 - rect.left));
    deer.style.setProperty('--eye-x', `${Math.round(x)}px`);
  };
  place();
  new ResizeObserver(place).observe(deer);
  window.addEventListener('resize', place, { passive: true });
}

/** With a mouse, the eye leans towards the pointer while the deer is on screen. */
function followPointer(deer: HTMLElement, visible: () => boolean) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let target = { x: 0, y: 0 };
  const now = { x: 0, y: 0 };
  let running = false;

  const step = () => {
    now.x += (target.x - now.x) * 0.08;
    now.y += (target.y - now.y) * 0.08;
    deer.style.setProperty('--look-x', `${now.x.toFixed(1)}px`);
    deer.style.setProperty('--look-y', `${now.y.toFixed(1)}px`);
    if (Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.5) requestAnimationFrame(step);
    else running = false;
  };
  const start = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(step);
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' || !visible()) return;
      target = { x: (event.clientX - window.innerWidth / 2) * 0.35, y: (event.clientY - window.innerHeight / 2) * 0.35 };
      start();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    target = { x: 0, y: 0 };
    start();
  });
}

export function initDeer() {
  const deer = document.querySelector<HTMLElement>('[data-deer]');
  if (!deer) return;
  placeEye(deer);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ends = new Map<Act, number>();
  const act = (name: Act, value = '') => {
    window.clearTimeout(ends.get(name));
    // Restart it if it is already playing.
    deer.removeAttribute(`data-${name}`);
    void deer.offsetWidth;
    deer.setAttribute(`data-${name}`, value);
    ends.set(
      name,
      window.setTimeout(() => deer.removeAttribute(`data-${name}`), LENGTH[name] + 50),
    );
  };

  // Each habit repeats at random intervals while the deer can be seen.
  const habits: { every: [number, number]; run: () => void }[] = [
    {
      every: [2500, 6000],
      run: () => {
        act('blink');
        // Now and then twice.
        if (Math.random() < 0.2) window.setTimeout(() => act('blink'), LENGTH.blink + 120);
      },
    },
    { every: [6000, 12000], run: () => act('twitch', Math.random() < 0.5 ? 'left' : 'right') },
    { every: [9000, 16000], run: () => act('sniff') },
  ];
  let timers: number[] = [];
  let seen = false;
  let visible = false;

  const stop = () => {
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
  };

  const start = () => {
    stop();
    if (!visible || document.hidden) return;
    habits.forEach((habit, index) => {
      const next = () => {
        timers[index] = window.setTimeout(() => {
          habit.run();
          next();
        }, between(...habit.every));
      };
      next();
    });
  };

  const greet = () => {
    act('twitch', 'both');
    act('blink');
  };

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !seen) {
        seen = true;
        // Once it has risen out of its icon.
        window.setTimeout(greet, 900);
      }
      start();
    },
    { threshold: 0.4 },
  ).observe(deer);

  document.addEventListener('visibilitychange', start);

  followPointer(deer, () => visible);

  deer.addEventListener('click', () => {
    greet();
    act('sniff');
    play('tap');
  });
}

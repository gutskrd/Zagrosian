/**
 * Life for Hevalo's deer, coming out of its hole in the page (HevaloDeer.astro):
 * while it is on screen it blinks every few seconds and, less
 * often, twitches an ear or sniffs; when it is first all the way out it pricks
 * up both ears and blinks, as if it had seen you; a tap or a click on it gets all
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

export function initDeer() {
  const deer = document.querySelector<HTMLElement>('[data-deer]');
  if (!deer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
      start();
    },
    { threshold: 0.4 },
  ).observe(deer);

  // It is all the way out once the icon's middle is above 45% of the screen's
  // height (HevaloDeer.astro): the first time, it greets you.
  const out = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting || seen) return;
      seen = true;
      out.disconnect();
      window.setTimeout(greet, 250);
    },
    { rootMargin: '0px 0px -55% 0px', threshold: 0.5 },
  );
  out.observe(deer);

  document.addEventListener('visibilitychange', start);

  deer.addEventListener('click', () => {
    greet();
    act('sniff');
    play('tap');
  });
}

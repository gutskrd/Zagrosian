/**
 * The opening screen (src/components/Preloader.astro).
 *
 * The counter follows the page's real loading (the window's load event), and
 * takes at least 1.4 seconds so it can be read. The horseman fills in and the
 * line draws across with it. Then the curtain rises, and the hero's entrance
 * plays from the start as it is uncovered: the headline, the ink
 * (`intro:end`) and the rest.
 *
 * Numbers are written in the page's own digits (Persian and Arabic use
 * their own), through Intl.NumberFormat.
 */

const MINIMUM = 1400;
const MAXIMUM = 4000;

const root = document.documentElement;

export const introRunning = () => root.dataset.intro !== undefined;

export function initIntro() {
  const screen = document.querySelector<HTMLElement>('[data-intro-screen]');
  if (!root.dataset.intro) return;
  if (!screen) {
    delete root.dataset.intro;
    return;
  }

  // The script has started, so the CSS fallback is no longer needed.
  root.dataset.intro = 'running';

  const count = screen.querySelector<HTMLElement>('[data-intro-count]');
  const bar = screen.querySelector<HTMLElement>('[data-intro-bar]');
  const rider = screen.querySelector<SVGElement>('[data-intro-rider]');
  const digits = new Intl.NumberFormat(root.lang || undefined, { maximumFractionDigits: 0 });

  let loaded = document.readyState === 'complete';
  window.addEventListener('load', () => (loaded = true), { once: true });

  const started = performance.now();
  let shown = 0;
  let written = -1;

  const render = (progress: number) => {
    const percent = Math.round(progress * 100);
    if (percent !== written && count) count.textContent = digits.format(percent);
    written = percent;
    if (bar) bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    // The drawing faces right in every language, so it fills from the left.
    if (rider) rider.style.clipPath = `inset(0 ${((1 - progress) * 100).toFixed(2)}% 0 0)`;
  };

  const leave = () => {
    screen.dataset.state = 'leaving';
    // The hero starts as the curtain begins to rise, so it is seen entering.
    window.setTimeout(() => {
      delete root.dataset.intro;
      replayHero();
      document.dispatchEvent(new CustomEvent('intro:end'));
    }, 320);
    window.setTimeout(() => (screen.hidden = true), 1150);
  };

  const tick = (now: number) => {
    const elapsed = now - started;
    const time = Math.min(1, elapsed / MINIMUM);
    let target = 1 - (1 - time) ** 3;
    // Hold short of the end until the page has loaded (or has had long enough).
    if (!loaded && elapsed < MAXIMUM) target = Math.min(target, 0.86);
    shown += (target - shown) * 0.14;
    if (target === 1 && 1 - shown < 0.004) shown = 1;
    render(shown);
    if (shown < 1) requestAnimationFrame(tick);
    else window.setTimeout(leave, 180);
  };
  requestAnimationFrame(tick);
}

/** Plays the hero's CSS entrance again from the start, now that it can be seen. */
function replayHero() {
  const hero = document.querySelector('.hero');
  if (!hero || typeof hero.getAnimations !== 'function') return;
  for (const animation of hero.getAnimations({ subtree: true })) {
    if (animation instanceof CSSAnimation) {
      animation.currentTime = 0;
      animation.play();
    }
  }
}

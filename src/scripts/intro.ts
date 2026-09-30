/**
 * The opening screen (src/components/Preloader.astro).
 *
 * The counter follows the page's real loading (the window's load event), and
 * takes at least a second so it can be read, three at most. The logo fills
 * in and the line draws across with it. Then the curtain rises, and
 * the hero's entrance plays from the start as it is uncovered (`intro:end`).
 * Afterwards the screen is removed from the page.
 *
 * Numbers are written in the page's own digits (Persian and Arabic use
 * their own), through Intl.NumberFormat.
 */

const MINIMUM = 1000;
const MAXIMUM = 3000;

const root = document.documentElement;

export function initIntro() {
  const screen = document.querySelector<HTMLElement>('[data-intro-screen]');
  if (!root.dataset.intro || !screen) {
    // Not this visit: it is not needed in the page at all.
    screen?.remove();
    delete root.dataset.intro;
    return;
  }

  // The script has started, so the CSS fallback is no longer needed.
  root.dataset.intro = 'running';

  const count = screen.querySelector<HTMLElement>('[data-intro-count]');
  const bar = screen.querySelector<HTMLElement>('[data-intro-bar]');
  const logo = screen.querySelector<HTMLElement | SVGElement>('[data-intro-logo]');
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
    // Filled from the bottom up, the same in every language.
    if (logo) logo.style.clipPath = `inset(${((1 - progress) * 100).toFixed(2)}% 0 0 0)`;
  };

  const leave = () => {
    screen.dataset.state = 'leaving';
    // The hero starts as the curtain begins to rise, so it is seen entering.
    window.setTimeout(() => {
      delete root.dataset.intro;
      replayHero();
      document.dispatchEvent(new CustomEvent('intro:end'));
    }, 320);
    window.setTimeout(() => screen.remove(), 1150);
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

/**
 * The opening screen (src/components/Preloader.astro).
 *
 * The page's loading drives it (the window's load event): it takes at least
 * 1.6 seconds, so the greeting can be read, and 3.4 at most. As it runs, the
 * ink fills the greeting, led by its band of light, the glass logo fills up,
 * the line draws across and "welcome" rolls through the languages, coming to
 * rest on the page's own. At the end the light passes over the greeting once
 * more; then the curtain rises, and the hero's entrance plays from the start
 * as it is uncovered (`intro:end`). Afterwards the screen is removed from the
 * page. A click, a tap or a key lifts it at once.
 *
 * Numbers are written in the page's own digits (Persian and Arabic use
 * their own), through Intl.NumberFormat.
 */

const MINIMUM = 1600;
const MAXIMUM = 3400;
/** How long the last pass of light over the greeting takes. */
const GLINT = 700;

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
  const greeting = screen.querySelector<HTMLElement>('[data-intro-greeting]');
  const track = screen.querySelector<HTMLElement>('[data-intro-track]');
  const steps = (track?.children.length ?? 1) - 1;
  const digits = new Intl.NumberFormat(root.lang || undefined, { maximumFractionDigits: 0 });

  let loaded = document.readyState === 'complete';
  window.addEventListener('load', () => (loaded = true), { once: true });

  const started = performance.now();
  let shown = 0;
  let written = -1;
  let step = -1;
  let leaving = false;

  const render = (progress: number) => {
    const percent = Math.round(progress * 100);
    if (percent !== written && count) count.textContent = digits.format(percent);
    written = percent;
    if (bar) bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    // Filled from the bottom up, the same in every language.
    if (logo) logo.style.clipPath = `inset(${((1 - progress) * 100).toFixed(2)}% 0 0 0)`;
    // The greeting is Kurmanji, so it fills from left to right on every page.
    greeting?.style.setProperty('--fill', progress.toFixed(4));
    greeting?.style.setProperty('--light', progress.toFixed(4));
    // Most of the languages go by while the counter is quick, early on.
    const next = Math.round(progress * steps);
    if (next !== step && track) track.style.setProperty('--step', String(next));
    step = next;
  };

  const leave = () => {
    if (leaving) return;
    leaving = true;
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    screen.dataset.state = 'leaving';
    // The hero starts as the curtain begins to rise, so it is seen entering.
    window.setTimeout(() => {
      delete root.dataset.intro;
      replayHero();
      document.dispatchEvent(new CustomEvent('intro:end'));
    }, 320);
    window.setTimeout(() => screen.remove(), 1150);
  };

  // Anyone in a hurry can lift it at once.
  const skip = (event: Event) => {
    if (event instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    leave();
  };
  window.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip);

  // The light passes over the whole greeting once more, then the curtain rises.
  const glint = () => {
    screen.dataset.state = 'done';
    const from = performance.now();
    const pass = (now: number) => {
      if (leaving) return;
      const time = Math.min(1, (now - from) / GLINT);
      const eased = time < 0.5 ? 4 * time ** 3 : 1 - (-2 * time + 2) ** 3 / 2;
      // From the greeting's start to well past its end, so no light is left on it.
      greeting?.style.setProperty('--light', (eased * 1.3).toFixed(4));
      if (time < 1) requestAnimationFrame(pass);
      else leave();
    };
    requestAnimationFrame(pass);
  };

  const tick = (now: number) => {
    if (leaving) return;
    const elapsed = now - started;
    const time = Math.min(1, elapsed / MINIMUM);
    let target = 1 - (1 - time) ** 3;
    // Hold short of the end until the page has loaded (or has had long enough).
    if (!loaded && elapsed < MAXIMUM) target = Math.min(target, 0.86);
    shown += (target - shown) * 0.14;
    if (target === 1 && 1 - shown < 0.004) shown = 1;
    render(shown);
    if (shown < 1) requestAnimationFrame(tick);
    else glint();
  };
  requestAnimationFrame(tick);
}

/**
 * Plays the hero's CSS entrance again from the start, now that it can be seen,
 * with the logo on its way into the story (story.ts), which sits beside it.
 */
function replayHero() {
  if (typeof Element.prototype.getAnimations !== 'function') return;
  for (const part of document.querySelectorAll('.hero, .journey')) {
    for (const animation of part.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation) {
        animation.currentTime = 0;
        animation.play();
      }
    }
  }
}

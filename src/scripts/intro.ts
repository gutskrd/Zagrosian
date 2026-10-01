/**
 * The opening screen (src/components/Preloader.astro).
 *
 * The page's loading drives it (the window's load event): it takes at least
 * 1.6 seconds, so the greeting can be read, and 3.4 at most. As it runs, the
 * ink fills the greeting, led by its band of light, the glass logo fills up,
 * the line draws across and "welcome" rolls through the languages, coming to
 * rest on the page's own. At the end the light passes over the greeting once
 * more.
 *
 * Then it waits for the visitor to come in, over "Enter"; every few seconds
 * "welcome" and "Enter" turn together to the next of the site's languages,
 * round and round, until the visitor comes in. Scrolling, swiping up or
 * dragging lifts the curtain, which follows the hand against a resistance
 * that grows the higher it goes (the rubber band of iOS scrolling); as it
 * does, the sun rises, the ring around it fills, dawn spreads along the foot
 * of the screen and the light crosses the greeting (`--lift` and `--pull`).
 * Let go short of the top and it all settles back, as on a spring; reach it
 * and the curtain flies up. A click, a tap or any key comes in at once, so
 * no one has to drag (WCAG 2.5.1 and 2.5.7). Left alone, the curtain lifts a
 * little every few seconds, to show that it can.
 *
 * Visitors who come from a search engine are not kept waiting: the curtain
 * rises by itself as soon as the page has loaded. Google counts an overlay
 * that has to be dismissed right after a search result is followed as
 * intrusive, and ranks such pages lower on phones.
 *
 * Coming in, the curtain rises and the hero's entrance plays from the start
 * as it is uncovered (`intro:end`). Afterwards the screen is removed from the
 * page.
 *
 * Numbers are written in the page's own digits (Persian and Arabic use
 * their own), through Intl.NumberFormat.
 */

const MINIMUM = 1600;
const MAXIMUM = 3400;
/** How long the last pass of light over the greeting takes. */
const GLINT = 700;
/** How long the visitor is left alone before the curtain shows it can lift, and how often after that. */
const NUDGE_AFTER = 2600;
const NUDGE_EVERY = 5200;
/** How long "welcome" and "Enter" stay in one language while the visitor waits. */
const TURN_EVERY = 2600;
/** Keys that would scroll the page underneath. */
const SCROLL_KEYS = [' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'];
const SEARCH_ENGINES = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|qwant|startpage|search\.brave|naver|seznam)\./;

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
  // "Welcome" and "Enter": the same languages in the same order, the first
  // again at the end (Preloader.astro).
  const tracks = [...screen.querySelectorAll<HTMLElement>('[data-intro-track]')];
  const languages = (tracks[0]?.children.length ?? 2) - 1;
  const digits = new Intl.NumberFormat(root.lang || undefined, { maximumFractionDigits: 0 });
  const gated = !fromSearchEngine();

  let loaded = document.readyState === 'complete';
  window.addEventListener('load', () => (loaded = true), { once: true });

  let state: 'loading' | 'ready' | 'leaving' = 'loading';
  let step = -1;
  let turning = 0;

  const turnTo = (next: number) => {
    step = next;
    for (const track of tracks) track.style.setProperty('--step', String(step));
  };

  // Then on to the next language every few seconds, for as long as the
  // visitor waits. After the last comes the first again (its copy at the end
  // of the tracks), and the tracks go back to their start without a jump.
  const turn = () => {
    turnTo(step + 1);
    if (step < languages) return;
    window.setTimeout(() => {
      for (const track of tracks) track.dataset.snap = '';
      turnTo(0);
      void tracks[0]?.offsetHeight;
      for (const track of tracks) delete track.dataset.snap;
    }, 800);
  };
  const started = performance.now();
  let shown = 0;
  let written = -1;

  const render = (progress: number) => {
    const percent = Math.round(progress * 100);
    // Drawn by CSS from the attribute, like the screen's words.
    if (percent !== written && count) count.dataset.label = digits.format(percent);
    written = percent;
    if (bar) bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    // Filled from the bottom up, the same in every language.
    if (logo) logo.style.clipPath = `inset(${((1 - progress) * 100).toFixed(2)}% 0 0 0)`;
    // The greeting is Kurmanji, so it fills from left to right on every page.
    greeting?.style.setProperty('--fill', progress.toFixed(4));
    greeting?.style.setProperty('--light', progress.toFixed(4));
    // Most of the languages go by while the counter is quick, early on, and
    // the roll comes to rest on the page's own, the last.
    const next = Math.round(progress * (languages - 1));
    if (next !== step) turnTo(next);
  };

  /* -------------------------------------------------------------------------
     Lifting the curtain.
     ------------------------------------------------------------------------- */

  /** How far the hand moves to come in (about two notches of a mouse wheel), and how far the curtain can give. */
  const travel = () => Math.min(200, window.innerHeight * 0.26);
  const give = () => window.innerHeight * 0.45;

  let pull = 0;
  let motion = 0;
  let nudgeTimer = 0;
  let wheelTimer = 0;
  let drag: { y: number; from: number; moved: number } | null = null;

  /** Moves the curtain for a hand that has moved `distance` pixels; returns how far there is to go, 0 to 1. */
  const lift = (distance: number) => {
    pull = Math.max(0, distance);
    const progress = Math.min(1, pull / travel());
    const d = give();
    const raised = (1 - 1 / ((pull * 0.55) / d + 1)) * d;
    screen.style.setProperty('--lift', raised.toFixed(1));
    screen.style.setProperty('--pull', progress.toFixed(3));
    greeting?.style.setProperty('--light', (progress * 1.3).toFixed(4));
    return progress;
  };

  const stop = () => {
    cancelAnimationFrame(motion);
    window.clearTimeout(nudgeTimer);
  };

  const scheduleNudge = (delay: number) => {
    window.clearTimeout(nudgeTimer);
    nudgeTimer = window.setTimeout(nudge, delay);
  };

  // Back down, as if on a spring: most of the way in half a second, however
  // fast the device draws.
  const settle = () => {
    stop();
    let last = performance.now();
    const fall = (now: number) => {
      const next = pull * Math.exp(-(now - last) / 130);
      last = now;
      if (next < 0.5) {
        lift(0);
        scheduleNudge(NUDGE_EVERY);
        return;
      }
      lift(next);
      motion = requestAnimationFrame(fall);
    };
    motion = requestAnimationFrame(fall);
  };

  // A small lift and back, to show that the curtain can be lifted.
  function nudge() {
    const from = performance.now();
    const rise = (now: number) => {
      const time = Math.min(1, (now - from) / 1100);
      lift(Math.sin(time * Math.PI) ** 2 * travel() * 0.22);
      if (time < 1) motion = requestAnimationFrame(rise);
      else scheduleNudge(NUDGE_EVERY);
    };
    motion = requestAnimationFrame(rise);
  }

  // The wheel moves the curtain, never the page underneath, until a pause in
  // the scrolling after the curtain has gone (so a trackpad's momentum does
  // not carry the visitor past the top). It is caught on its way down, before
  // the smooth scrolling (smooth.ts) sees it.
  let quiet = 0;
  const release = () => window.removeEventListener('wheel', onWheel, { capture: true });
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!screen.isConnected) {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(release, 240);
      return;
    }
    if (state !== 'ready') return;
    stop();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    if (lift(pull + event.deltaY * unit) >= 1) {
      enter();
      return;
    }
    // A pause long enough to be more than the gap between turns of a wheel lets it settle.
    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(settle, 600);
  };

  const onPointerDown = (event: PointerEvent) => {
    // Only the main button: a right click is not a way in.
    if (!event.isPrimary || event.button !== 0) return;
    // Anyone in a hurry can come in before the page has finished.
    if (state === 'loading') {
      enter();
      return;
    }
    if (state !== 'ready') return;
    stop();
    drag = { y: event.clientY, from: pull, moved: 0 };
    screen.setPointerCapture(event.pointerId);
    screen.dataset.dragging = '';
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drag || !event.isPrimary) return;
    drag.moved = Math.max(drag.moved, Math.abs(event.clientY - drag.y));
    if (lift(drag.from + drag.y - event.clientY) >= 1) enter();
  };

  const onPointerUp = () => {
    if (!drag) return;
    const { moved } = drag;
    drag = null;
    delete screen.dataset.dragging;
    if (state !== 'ready') return;
    // A click or a tap comes in; so does a lift let go past halfway.
    if (moved < 8 || pull / travel() > 0.5) enter();
    else settle();
  };

  const onKey = (event: KeyboardEvent) => {
    // Not the browser's own shortcuts (reload, address bar, …).
    if (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Shift') return;
    if (SCROLL_KEYS.includes(event.key)) event.preventDefault();
    enter();
  };

  window.addEventListener('wheel', onWheel, { capture: true, passive: false });
  window.addEventListener('keydown', onKey);
  screen.addEventListener('pointerdown', onPointerDown);
  screen.addEventListener('pointermove', onPointerMove);
  screen.addEventListener('pointerup', onPointerUp);
  screen.addEventListener('pointercancel', onPointerUp);

  /* -------------------------------------------------------------------------
     Coming in.
     ------------------------------------------------------------------------- */

  const enter = () => {
    if (state === 'leaving') return;
    state = 'leaving';
    stop();
    window.clearInterval(turning);
    window.clearTimeout(wheelTimer);
    window.removeEventListener('keydown', onKey);
    screen.style.setProperty('--pull', '1');
    screen.dataset.state = 'leaving';
    // The hero starts as the curtain begins to rise, so it is seen entering.
    window.setTimeout(() => {
      replayHero();
      document.dispatchEvent(new CustomEvent('intro:end'));
    }, 320);
    // The page is held still (here, and by smooth.ts while `data-intro` is
    // set) until the curtain has gone, so a scroll that carries on past the
    // way in does not move it: the visitor arrives at the top.
    window.setTimeout(() => {
      screen.remove();
      delete root.dataset.intro;
      quiet = window.setTimeout(release, 240);
    }, 1150);
  };

  // Ready: the way in appears (or, from a search engine, the curtain rises).
  const ready = () => {
    if (state !== 'loading') return;
    if (!gated) {
      enter();
      return;
    }
    state = 'ready';
    screen.dataset.state = 'ready';
    // The custom cursor (cursor.ts) shows that the screen can be clicked.
    screen.dataset.cursor = 'link';
    lift(0);
    scheduleNudge(NUDGE_AFTER);
    turning = window.setInterval(turn, TURN_EVERY);
  };

  // The light passes over the whole greeting once more.
  const glint = () => {
    screen.dataset.state = 'done';
    const from = performance.now();
    const pass = (now: number) => {
      if (state !== 'loading') return;
      const time = Math.min(1, (now - from) / GLINT);
      const eased = time < 0.5 ? 4 * time ** 3 : 1 - (-2 * time + 2) ** 3 / 2;
      // From the greeting's start to well past its end, so no light is left on it.
      greeting?.style.setProperty('--light', (eased * 1.3).toFixed(4));
      if (time < 1) requestAnimationFrame(pass);
      else ready();
    };
    requestAnimationFrame(pass);
  };

  const tick = (now: number) => {
    if (state !== 'loading') return;
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

/** Whether the visitor has just followed a link from a search engine's results. */
function fromSearchEngine() {
  try {
    return SEARCH_ENGINES.test(new URL(document.referrer).hostname);
  } catch {
    return false;
  }
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

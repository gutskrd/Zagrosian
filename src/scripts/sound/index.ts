/**
 * Opt-in sound.
 *
 * Handles the stored preference, the toggles in the header and menu, the one-time prompt, and cue
 * playback. Runs on every page via main.ts. The synthesizer (engine.ts: a generative ambient score
 * and UI sounds, no audio files) is only downloaded once sound is on.
 *
 * Autoplay policies only allow audio after a user gesture, so sound starts when it's switched on,
 * and on later pages:
 * - Chrome and Edge carry the activation over from the referring page, so the score resumes on
 *   load;
 * - other browsers need a click, tap or key press on the new page first.
 *
 * The score fades out on navigation instead of cutting off, and pauses while the tab is hidden.
 */

import { POPOVER } from '../utils/popover';
import type { Cue } from './engine';

type Engine = typeof import('./engine');

const STORAGE_KEY = 'sound';
const root = document.documentElement;

// --- Preference ---

/** 'on', 'off', or undefined if the visitor hasn't chosen yet. */
function soundPreference(): 'on' | 'off' | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'on' || stored === 'off' ? stored : undefined;
  } catch {
    return undefined;
  }
}

let enabled = soundPreference() === 'on';

export const soundEnabled = () => enabled;

// --- Audio: the context up front, the synthesizer on demand ---

let context: AudioContext | undefined;
let engine: Engine | undefined;
let loading: Promise<Engine> | undefined;

const load = () => (loading ??= import('./engine').then((module) => (engine = module)));

function createContext() {
  const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Context ? new Context({ latencyHint: 'interactive' }) : undefined;
}

/**
 * Starts audio if sound is on: creates or resumes the AudioContext, loads the synthesizer and
 * starts the score. Call it from a user gesture where possible, since that's when browsers allow
 * it. Resolves once the score is playing, or can't.
 */
function wake(): Promise<void> {
  if (!enabled || document.hidden) return Promise.resolve();
  context ??= createContext();
  const audio = context;
  if (!audio) return Promise.resolve();
  const running = audio.state === 'running' ? Promise.resolve() : audio.resume();
  return Promise.all([load(), running]).then(
    ([module]) => {
      if (!enabled || audio.state !== 'running') return;
      module.attach(audio);
      module.startScore();
    },
    () => {},
  );
}

/** Plays a UI cue if sound is on and the browser allows it. */
export function play(cue: Cue) {
  if (!enabled || !engine || context?.state !== 'running') return;
  engine.cue(cue);
}

function reflect() {
  root.toggleAttribute('data-sound', enabled);
  for (const toggle of document.querySelectorAll('[data-sound-toggle]')) {
    toggle.setAttribute('aria-pressed', String(enabled));
  }
}

/** Turns sound on or off and persists the choice. */
export function setSound(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage unavailable: applies to this page only.
  }
  if (on === enabled) return reflect();
  enabled = on;
  reflect();
  if (on) {
    // Chime once audio is running.
    void wake().then(() => play('on'));
  } else if (engine) {
    if (context?.state === 'running') engine.cue('off');
    engine.stopScore();
  }
  document.dispatchEvent(new CustomEvent('sound:change', { detail: { on } }));
}

// --- Arrival ---

/**
 * Runs `callback` once the page is visible. Chrome may prerender the next page
 * (speculation-rules.json); a prerendered page stays hidden until activated, so anything timed or
 * audible waits for that.
 */
function whenShown(callback: () => void) {
  if ((document as Document & { prerendering?: boolean }).prerendering) {
    document.addEventListener('prerenderingchange', callback, { once: true });
  } else {
    callback();
  }
}

/**
 * Whether audio can likely start before any interaction: `navigator.getAutoplayPolicy()` where
 * available; otherwise only for a regular navigation from another page of the site. Reloads and
 * back/forward carry no activation, and trying would just log a warning.
 */
function mayStartOnArrival() {
  const policy = (navigator as Navigator & { getAutoplayPolicy?(type: 'audiocontext'): string }).getAutoplayPolicy?.(
    'audiocontext',
  );
  if (policy) return policy === 'allowed';
  const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (navigation && navigation.type !== 'navigate') return false;
  try {
    return new URL(document.referrer).origin === location.origin;
  } catch {
    return false;
  }
}

/** Whether clicking this link opens another page of the site in the same tab. */
function leavesForAnotherPage(link: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  if (link.target || link.hasAttribute('download')) return false;
  const url = new URL(link.href, location.href);
  const samePage = url.pathname === location.pathname && url.search === location.search;
  return url.origin === location.origin && !samePage;
}

// --- One-time sound prompt (SoundPrompt.astro) ---

function initPrompt() {
  const prompt = document.querySelector<HTMLElement>('[data-sound-prompt]');
  if (!prompt || soundPreference() !== undefined) return;

  const suggestion = document.querySelector<HTMLElement>('[data-language-suggestion]');
  let visible = false;
  /** Scroll position when the prompt appeared. */
  let shownAt = 0;

  const hide = () => {
    if (!visible) return;
    visible = false;
    prompt.toggleAttribute('data-visible', false);
    window.setTimeout(() => (prompt.hidden = true), 700);
  };

  // On the book page the prompt would cover the reader's controls and page-turn corner, so it hides
  // while the book is in view and isn't offered then.
  let bookInView = false;
  const book = document.querySelector('[data-book-stage]');
  if (book) {
    new IntersectionObserver(
      ([entry]) => {
        bookInView = entry?.isIntersecting ?? false;
        if (bookInView) hide();
      },
      { threshold: 0.35 },
    ).observe(book);
  }

  const show = () => {
    if (visible || bookInView || soundPreference() !== undefined) return;
    // The language suggestion uses the same corner; wait until it closes.
    if (suggestion && !suggestion.hidden) {
      new MutationObserver((_, observer) => {
        if (!suggestion.hidden) return;
        observer.disconnect();
        window.setTimeout(show, 600);
      }).observe(suggestion, { attributes: true, attributeFilter: ['hidden'] });
      return;
    }
    visible = true;
    shownAt = window.scrollY;
    prompt.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => prompt.toggleAttribute('data-visible', true)));
  };

  // Offered on the first page of a visit only; arriving from another page of the site means it was
  // already seen (nothing is stored).
  let cameFromSite = false;
  try {
    cameFromSite = !!document.referrer && new URL(document.referrer).origin === location.origin;
  } catch {
    // An unreadable referrer counts as an external arrival.
  }
  if (cameFromSite) return;

  // Shortly after the page settles.
  whenShown(() => window.setTimeout(show, 2500));

  // Ignored while the visitor keeps reading, it dismisses itself instead of following them down the
  // page. No answer is recorded.
  window.addEventListener(
    'scroll',
    () => {
      if (!visible || prompt.contains(document.activeElement)) return;
      if (Math.abs(window.scrollY - shownAt) > window.innerHeight * 0.75) hide();
    },
    { passive: true },
  );

  for (const button of prompt.querySelectorAll<HTMLElement>('[data-sound-choice]')) {
    button.addEventListener('click', () => {
      setSound(button.dataset.soundChoice === 'on');
      hide();
    });
  }
  // Chosen elsewhere (header, menu or command menu).
  document.addEventListener('sound:change', hide);
}

// --- UI sounds ---

const INTERACTIVE = 'a[href], button:not([disabled]), summary, [role="option"], label[for]';
/** Controls with their own sounds: the toggles and menu buttons. */
const OWN_SOUND = '[data-sound-toggle], [data-sound-choice], [popovertarget], [data-command-open]';

function initInterfaceSounds() {
  // Tick on pointer hover and keyboard focus.
  let hovered: Element | null = null;
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    const target = (event.target as Element | null)?.closest?.(INTERACTIVE) ?? null;
    if (target && target !== hovered) play('hover');
    hovered = target;
  });
  document.addEventListener('focusin', (event) => {
    const target = event.target as Element | null;
    if (target?.matches?.(':focus-visible') && target.matches(INTERACTIVE)) play('hover');
  });

  // Tap on every click. Following a link to another page also fades out the score, so navigation
  // never cuts it off mid-note.
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest?.(INTERACTIVE);
    if (!target || target.matches(OWN_SOUND)) return;
    play('tap');
    if (target instanceof HTMLAnchorElement && leavesForAnotherPage(target, event)) engine?.stopScore(0.25);
  });

  // Menu open/close sounds.
  for (const popover of document.querySelectorAll<HTMLElement>(POPOVER)) {
    popover.addEventListener('toggle', (event) => play((event as ToggleEvent).newState === 'open' ? 'open' : 'close'));
  }
}


export function initSound() {
  reflect();
  initPrompt();
  initInterfaceSounds();

  for (const toggle of document.querySelectorAll('[data-sound-toggle]')) {
    toggle.addEventListener('click', () => setSound(!enabled));
  }

  // Events browsers accept as activation for audio: pointer or key down, or touchend.
  const unlock = () => void wake();
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
    document.addEventListener(type, unlock, { capture: true, passive: true });
  }

  // Arriving from another page of the site: resume the score on load.
  whenShown(() => {
    if (enabled && mayStartOnArrival()) void wake();
  });

  // Pause while the tab is hidden; resume when it's visible again, including bfcache restores.
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) context.suspend().catch(() => {});
    else void wake();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && context) void wake();
  });
}

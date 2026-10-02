/**
 * Sound, for visitors who turn it on.
 *
 * This module handles the choice (remembered), the toggles in the header and
 * the menu, the card that offers sound once, and when to play what. It runs
 * on every page through site.ts, so sound behaves the same on the homepage,
 * the legal pages and the 404 page. The synthesiser itself (sound-engine.ts:
 * an ambient score and interface sounds, generated in the browser, no audio
 * files) is downloaded only once sound is on.
 *
 * Browsers let a page start audio only after a click, tap or key press on it.
 * So sound starts the moment the visitor turns it on, and on each next page:
 * - Chrome and Edge carry that permission over from the page the link was on,
 *   so the score comes back as the page opens;
 * - other browsers need a click, tap or key press on the new page first.
 * Following a link, the score fades out instead of being cut off. Sound pauses
 * while the tab is hidden.
 */

export type Cue = 'hover' | 'tap' | 'open' | 'close' | 'on' | 'off';

type Engine = typeof import('./sound-engine');

const STORAGE_KEY = 'sound';
const root = document.documentElement;

/* -------------------------------------------------------------------------- */
/* Preference                                                                 */
/* -------------------------------------------------------------------------- */

/** 'on', 'off', or undefined when the visitor has not chosen yet. */
export function soundPreference(): 'on' | 'off' | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'on' || stored === 'off' ? stored : undefined;
  } catch {
    return undefined;
  }
}

let enabled = soundPreference() === 'on';

export const soundEnabled = () => enabled;

/* -------------------------------------------------------------------------- */
/* Audio: the context now, the synthesiser when it is needed                  */
/* -------------------------------------------------------------------------- */

let context: AudioContext | undefined;
let engine: Engine | undefined;
let loading: Promise<Engine> | undefined;

const load = () => (loading ??= import('./sound-engine').then((module) => (engine = module)));

function createContext() {
  const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Context ? new Context({ latencyHint: 'interactive' }) : undefined;
}

/**
 * Starts the audio, if sound is on: creates or resumes the AudioContext, loads
 * the synthesiser and starts the score. Call it from a click or key press
 * where possible, since that is when browsers allow it. Resolves once the
 * score is playing, or cannot.
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

/** Plays an interface sound, if sound is on and the browser allows it. */
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

/** Turns sound on or off and remembers the choice. */
export function setSound(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Not remembered, but still applied.
  }
  if (on === enabled) return reflect();
  enabled = on;
  reflect();
  if (on) {
    // The bells once the audio is running.
    void wake().then(() => play('on'));
  } else if (engine) {
    if (context?.state === 'running') engine.cue('off');
    engine.stopScore();
  }
  document.dispatchEvent(new CustomEvent('sound:change', { detail: { on } }));
}

/* -------------------------------------------------------------------------- */
/* Arriving on a page                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Runs `callback` once the page is on screen. Chrome may prepare the next
 * page before the visitor opens it (speculation-rules.json); such a page is
 * hidden until then, so anything timed or audible waits for that moment.
 */
function whenShown(callback: () => void) {
  if ((document as Document & { prerendering?: boolean }).prerendering) {
    document.addEventListener('prerenderingchange', callback, { once: true });
  } else {
    callback();
  }
}

/**
 * Whether the browser is likely to let this page start audio before the
 * visitor touches it: they came from another page of the site by following a
 * link, and the browser does not say it would refuse. A reload or the back
 * button carries no permission, and trying would only log a warning.
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

/** Whether a click on this link opens another page of the site in this tab. */
function leavesForAnotherPage(link: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  if (link.target || link.hasAttribute('download')) return false;
  const url = new URL(link.href, location.href);
  const samePage = url.pathname === location.pathname && url.search === location.search;
  return url.origin === location.origin && !samePage;
}

/* -------------------------------------------------------------------------- */
/* The card, offered once (src/components/SoundPrompt.astro)                  */
/* -------------------------------------------------------------------------- */

function initPrompt() {
  const prompt = document.querySelector<HTMLElement>('[data-sound-prompt]');
  if (!prompt || soundPreference() !== undefined) return;

  const suggestion = document.querySelector<HTMLElement>('[data-language-suggestion]');
  let visible = false;

  const hide = () => {
    if (!visible) return;
    visible = false;
    prompt.toggleAttribute('data-visible', false);
    window.setTimeout(() => (prompt.hidden = true), 700);
  };

  const show = () => {
    if (visible || soundPreference() !== undefined) return;
    // The language note uses the same corner: this card waits for it to go.
    if (suggestion && !suggestion.hidden) {
      new MutationObserver((_, observer) => {
        if (!suggestion.hidden) return;
        observer.disconnect();
        window.setTimeout(show, 600);
      }).observe(suggestion, { attributes: true, attributeFilter: ['hidden'] });
      return;
    }
    visible = true;
    prompt.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => prompt.toggleAttribute('data-visible', true)));
  };

  // A moment after the page has settled.
  whenShown(() => window.setTimeout(show, 2500));

  for (const button of prompt.querySelectorAll<HTMLElement>('[data-sound-choice]')) {
    button.addEventListener('click', () => {
      setSound(button.dataset.soundChoice === 'on');
      hide();
    });
  }
  // Chosen elsewhere (the header, the menu or quick navigation).
  document.addEventListener('sound:change', hide);
}

/* -------------------------------------------------------------------------- */
/* Interface sounds                                                           */
/* -------------------------------------------------------------------------- */

const INTERACTIVE = 'a[href], button:not([disabled]), summary, [role="option"], label[for]';
/** Controls with sounds of their own: the toggles, and buttons that open a menu. */
const OWN_SOUND = '[data-sound-toggle], [data-sound-choice], [popovertarget], [data-command-open]';

function initInterfaceSounds() {
  // A tick as the pointer or keyboard reaches a control.
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

  // A tap on every click. Following a link to another page, the score also
  // fades out, so the page change never cuts it off mid-note.
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest?.(INTERACTIVE);
    if (!target || target.matches(OWN_SOUND)) return;
    play('tap');
    if (target instanceof HTMLAnchorElement && leavesForAnotherPage(target, event)) engine?.stopScore(0.25);
  });

  // Menus opening and closing.
  for (const popover of document.querySelectorAll<HTMLElement>('[popover]')) {
    popover.addEventListener('toggle', (event) => play((event as ToggleEvent).newState === 'open' ? 'open' : 'close'));
  }
}

/* -------------------------------------------------------------------------- */

export function initSound() {
  reflect();
  initPrompt();
  initInterfaceSounds();

  for (const toggle of document.querySelectorAll('[data-sound-toggle]')) {
    toggle.addEventListener('click', () => setSound(!enabled));
  }

  // The events browsers accept as permission to start audio: a mouse button
  // or a key going down, or a finger lifting.
  const unlock = () => void wake();
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
    document.addEventListener(type, unlock, { capture: true, passive: true });
  }

  // Coming from another page of the site, the score picks up as the page opens.
  whenShown(() => {
    if (enabled && mayStartOnArrival()) void wake();
  });

  // Silent while the tab is hidden; back with it. Coming back to this page
  // with the browser's back button, the score picks up again.
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) context.suspend().catch(() => {});
    else void wake();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && context) void wake();
  });
}

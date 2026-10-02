/**
 * Sound, for visitors who turn it on.
 *
 * This small module handles the choice (remembered), the header and menu
 * toggles, the card that offers sound once, and when to play what. The
 * synthesiser itself (sound-engine.ts: an ambient score and interface sounds,
 * all generated in the browser, no audio files) is downloaded only once sound
 * is on, so visitors who keep it off never load it.
 *
 * Sound is off until the visitor turns it on, from the header, the menu, the
 * card, or quick navigation. Browsers only allow audio after a click or key
 * press, so the AudioContext is created in that moment; on a new page the
 * score resumes with the visitor's first interaction, or at once where the
 * browser allows it. It pauses while the tab is hidden.
 */

export type Cue = 'hover' | 'tap' | 'open' | 'close' | 'on' | 'off' | 'leave';

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
 * Starts the audio, if sound is on. Called from a click or key press where
 * possible, since that is when browsers allow it. Resolves once the score is
 * playing (or cannot).
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
/* The prompt, offered once (src/components/SoundPrompt.astro)                */
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
  window.setTimeout(show, 2500);

  for (const button of prompt.querySelectorAll<HTMLElement>('[data-sound-choice]')) {
    button.addEventListener('click', () => {
      setSound(button.dataset.soundChoice === 'on');
      hide();
    });
  }
  // Chosen elsewhere (the header or quick navigation).
  document.addEventListener('sound:change', hide);
}

/* -------------------------------------------------------------------------- */

const INTERACTIVE = 'a[href], button:not([disabled]), summary, [role="option"], label[for]';

export function initSound() {
  reflect();
  initPrompt();

  for (const toggle of document.querySelectorAll('[data-sound-toggle]')) {
    toggle.addEventListener('click', () => setSound(!enabled));
  }

  // The first click or key press on a page lets the audio start.
  const unlock = () => void wake();
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true, passive: true });

  // Coming from another page of this site, the browser may allow it at once.
  if (enabled) {
    let sameSite = false;
    try {
      sameSite = new URL(document.referrer).origin === location.origin;
    } catch {
      // No referrer.
    }
    if (sameSite) void wake();
  }

  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) context.suspend().catch(() => {});
    else if (enabled) void wake();
  });

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

  // A tap on a click; a sweep when leaving for another page of the site.
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest?.(INTERACTIVE);
    // Toggles and menu buttons have their own sounds.
    if (!target || target.matches('[data-sound-toggle], [data-sound-choice], [popovertarget], [data-command-open]')) return;
    if (target instanceof HTMLAnchorElement && !event.defaultPrevented) {
      const url = new URL(target.href, location.href);
      const samePage = url.pathname === location.pathname && url.search === location.search;
      if (url.origin === location.origin && !samePage && !target.target && !target.hasAttribute('download')) {
        play('leave');
        return;
      }
    }
    play('tap');
  });

  // Menus opening and closing.
  for (const popover of document.querySelectorAll<HTMLElement>('[popover]')) {
    popover.addEventListener('toggle', (event) => play((event as ToggleEvent).newState === 'open' ? 'open' : 'close'));
  }
}

/**
 * Sound, for visitors who turn it on (Web Audio).
 *
 * Everything is synthesised in the browser: no audio files are downloaded,
 * and the Content-Security-Policy needs no media sources.
 *
 * - An ambient score: a slow, low chord in D Phrygian (the scale of the Kurdish
 *   maqam Kurd) that breathes in and out, wind as if across the mountains, and
 *   now and then a soft bell, all in a small generated reverb.
 * - Interface sounds: a light tick when the pointer or keyboard reaches a
 *   control, a soft tap on a click, air when a menu opens or closes, a sweep
 *   when leaving for another page, and a rising or falling pair of bells when
 *   sound is switched on or off.
 *
 * Sound is off until the visitor turns it on, from the header, the prompt that
 * offers it once, or quick navigation. The choice is remembered. Browsers only
 * allow audio after a click or key press, so on a new page the score resumes
 * with the visitor's first interaction, or at once where the browser allows
 * it. It pauses while the tab is hidden.
 */

export type Cue = 'hover' | 'tap' | 'open' | 'close' | 'on' | 'off' | 'leave';

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
/* The audio graph                                                            */
/* -------------------------------------------------------------------------- */

interface Graph {
  context: AudioContext;
  /** Everything ends here, through a gentle limiter. */
  master: GainNode;
  /** Sent to the reverb. */
  space: GainNode;
  noise: AudioBuffer;
}

let graph: Graph | undefined;

/** A stereo reverb tail: decaying noise. */
function impulse(context: AudioContext, seconds: number, decay: number) {
  const length = Math.round(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

/** A few seconds of soft (pink) noise, looped for the wind and air sounds. */
function pinkNoise(context: AudioContext, seconds: number) {
  const length = Math.round(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
  }
  return buffer;
}

function createGraph(): Graph | undefined {
  const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  const context = new Context({ latencyHint: 'interactive' });

  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 12;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.connect(context.destination);

  const master = context.createGain();
  master.gain.value = 0.9;
  master.connect(limiter);

  const reverb = context.createConvolver();
  reverb.buffer = impulse(context, 3.5, 2.4);
  const space = context.createGain();
  space.gain.value = 1;
  const wet = context.createGain();
  wet.gain.value = 0.4;
  space.connect(reverb).connect(wet).connect(master);

  return { context, master, space, noise: pinkNoise(context, 4) };
}

/* -------------------------------------------------------------------------- */
/* Ambient score                                                              */
/* -------------------------------------------------------------------------- */

interface Score {
  stop(): void;
}

let score: Score | undefined;

/** A slow sine that moves a parameter: value ± depth, `rate` times a second. */
function lfo(context: AudioContext, param: AudioParam, rate: number, depth: number, stopAt: (() => void)[]) {
  const oscillator = context.createOscillator();
  oscillator.frequency.value = rate;
  const amount = context.createGain();
  // Half of them start by falling, so no two voices move together.
  amount.gain.value = Math.random() < 0.5 ? depth : -depth;
  oscillator.connect(amount).connect(param);
  oscillator.start();
  stopAt.push(() => oscillator.stop());
}

/** A struck bell: a fundamental and an inharmonic partial, into the reverb. */
function bell(g: Graph, frequency: number, level: number, when = g.context.currentTime, into?: AudioNode) {
  const { context } = g;
  const out = context.createGain();
  out.gain.setValueAtTime(0, when);
  out.gain.linearRampToValueAtTime(level, when + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, when + 2.8);
  out.connect(into ?? g.master);
  const send = context.createGain();
  send.gain.value = 0.9;
  out.connect(send).connect(g.space);

  for (const [ratio, gain] of [
    [1, 1],
    [2.76, 0.28],
    [5.4, 0.08],
  ] as const) {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency * ratio;
    const partial = context.createGain();
    partial.gain.value = gain;
    oscillator.connect(partial).connect(out);
    oscillator.start(when);
    oscillator.stop(when + 3);
  }
}

function startScore(g: Graph): Score {
  const { context } = g;
  const now = context.currentTime;
  const stops: (() => void)[] = [];

  const bus = context.createGain();
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(0.75, now + 4);
  bus.connect(g.master);
  const send = context.createGain();
  send.gain.value = 0.5;
  bus.connect(send).connect(g.space);

  // The chord: D, A, D, F, A, C. Each note is two slightly detuned voices
  // whose loudness drifts on its own slow cycle, through a darkening filter.
  const tone = context.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 820;
  tone.Q.value = 0.4;
  tone.connect(bus);
  lfo(context, tone.frequency, 0.037, 320, stops);

  const notes = [73.42, 110, 146.83, 174.61, 220, 261.63];
  notes.forEach((frequency, index) => {
    const voice = context.createGain();
    const level = 0.055 / Math.sqrt(notes.length) * (index < 2 ? 1.4 : 1);
    voice.gain.value = level * 0.6;
    voice.connect(tone);
    lfo(context, voice.gain, 0.02 + Math.random() * 0.05, level * 0.4, stops);
    for (const [type, cents] of [
      ['sine', -4],
      ['triangle', 5],
    ] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.detune.value = cents;
      oscillator.connect(voice);
      oscillator.start(now);
      stops.push(() => oscillator.stop());
    }
  });

  // Wind: soft noise through a band that wanders, in slow gusts.
  const wind = context.createBufferSource();
  wind.buffer = g.noise;
  wind.loop = true;
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 520;
  band.Q.value = 0.9;
  lfo(context, band.frequency, 0.031, 260, stops);
  const gusts = context.createGain();
  gusts.gain.value = 0.16;
  lfo(context, gusts.gain, 0.071, 0.1, stops);
  wind.connect(band).connect(gusts).connect(bus);
  wind.start(now);
  stops.push(() => wind.stop());

  // Bells, now and then, from the same scale.
  const scale = [293.66, 311.13, 349.23, 392, 440, 523.25, 587.33];
  let timer = 0;
  const ring = () => {
    const frequency = scale[Math.floor(Math.random() * scale.length)];
    bell(g, frequency, 0.05 + Math.random() * 0.03, context.currentTime, bus);
    // Sometimes a second, softer note answers.
    if (Math.random() < 0.35) {
      const answer = scale[Math.floor(Math.random() * scale.length)];
      bell(g, answer, 0.03, context.currentTime + 0.35 + Math.random() * 0.4, bus);
    }
    timer = window.setTimeout(ring, 5000 + Math.random() * 7000);
  };
  timer = window.setTimeout(ring, 2500);

  return {
    stop() {
      window.clearTimeout(timer);
      const at = context.currentTime;
      bus.gain.cancelScheduledValues(at);
      bus.gain.setValueAtTime(bus.gain.value, at);
      bus.gain.linearRampToValueAtTime(0, at + 1.2);
      window.setTimeout(() => {
        for (const stop of stops) {
          try {
            stop();
          } catch {
            // Already stopped.
          }
        }
        bus.disconnect();
      }, 1400);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Interface sounds                                                           */
/* -------------------------------------------------------------------------- */

/** A burst of filtered noise whose band sweeps from one frequency to another. */
function air(g: Graph, from: number, to: number, duration: number, level: number) {
  const { context } = g;
  const now = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = g.noise;
  source.playbackRate.value = 1.2;
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.4;
  band.frequency.setValueAtTime(from, now);
  band.frequency.exponentialRampToValueAtTime(to, now + duration);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(level, now + duration * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(band).connect(gain);
  gain.connect(g.master);
  const send = context.createGain();
  send.gain.value = 0.5;
  gain.connect(send).connect(g.space);
  source.start(now, Math.random() * 3);
  source.stop(now + duration + 0.05);
}

/** A short tone that glides from one pitch to another. */
function blip(g: Graph, from: number, to: number, duration: number, level: number, type: OscillatorType = 'sine', reverb = 0.15) {
  const { context } = g;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, now);
  oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(level, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(g.master);
  if (reverb) {
    const send = context.createGain();
    send.gain.value = reverb;
    gain.connect(send).connect(g.space);
  }
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

let lastHover = 0;

function render(cue: Cue, g: Graph) {
  const vary = 1 + (Math.random() - 0.5) * 0.06;
  switch (cue) {
    case 'hover': {
      const now = performance.now();
      if (now - lastHover < 45) return;
      lastHover = now;
      blip(g, 2400 * vary, 1800 * vary, 0.05, 0.022, 'triangle', 0.05);
      break;
    }
    case 'tap':
      blip(g, 540 * vary, 360 * vary, 0.16, 0.09, 'sine', 0.2);
      blip(g, 3200, 2400, 0.02, 0.02, 'triangle', 0);
      break;
    case 'open':
      air(g, 320, 2600, 0.5, 0.11);
      blip(g, 220, 330, 0.5, 0.03, 'sine', 0.4);
      break;
    case 'close':
      air(g, 2400, 300, 0.4, 0.09);
      break;
    case 'on':
      bell(g, 440, 0.07);
      bell(g, 587.33, 0.06, g.context.currentTime + 0.12);
      break;
    case 'off':
      bell(g, 587.33, 0.05);
      bell(g, 440, 0.04, g.context.currentTime + 0.12);
      break;
    case 'leave':
      air(g, 180, 1400, 0.55, 0.12);
      blip(g, 110, 82.41, 0.6, 0.06, 'sine', 0.5);
      break;
  }
}

/** Plays an interface sound, if sound is on and the browser allows it. */
export function play(cue: Cue) {
  if (!enabled || !graph || graph.context.state !== 'running') return;
  render(cue, graph);
}

/* -------------------------------------------------------------------------- */
/* Switching on and off                                                       */
/* -------------------------------------------------------------------------- */

/** Starts the audio, if sound is on. Call from a click or key press where possible. */
function wake() {
  if (!enabled || document.hidden) return;
  graph ??= createGraph();
  if (!graph) return;
  const start = () => {
    if (enabled && !score && graph?.context.state === 'running') score = startScore(graph);
  };
  if (graph.context.state === 'running') start();
  else graph.context.resume().then(start, () => {});
}

function sleep() {
  score?.stop();
  score = undefined;
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
    wake();
    // The bells once the audio is running.
    const chime = () => play('on');
    if (graph?.context.state === 'running') chime();
    else graph?.context.resume().then(chime, () => {});
  } else if (graph) {
    render('off', graph);
    sleep();
  }
  document.dispatchEvent(new CustomEvent('sound:change', { detail: { on } }));
}

/* -------------------------------------------------------------------------- */

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

  // A moment after the page has settled (and the opening screen has gone).
  const later = () => window.setTimeout(show, 2500);
  if (root.dataset.intro) document.addEventListener('intro:end', later, { once: true });
  else later();

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
  const unlock = () => wake();
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
    if (sameSite) wake();
  }

  document.addEventListener('visibilitychange', () => {
    if (!graph) return;
    if (document.hidden) graph.context.suspend().catch(() => {});
    else if (enabled) graph.context.resume().then(() => wake(), () => {});
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

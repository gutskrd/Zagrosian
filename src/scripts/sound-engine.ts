/**
 * The synthesiser behind the site's sound (Web Audio). Loaded only once a
 * visitor turns sound on; sound.ts decides when, and owns the AudioContext.
 *
 * Everything is synthesised in the browser: no audio files are downloaded,
 * and the Content-Security-Policy needs no media sources.
 *
 * - An ambient score: a slow, low chord in D Phrygian (the scale of the Kurdish
 *   maqam Kurd) that breathes in and out, wind as if across the mountains, and
 *   now and then a soft bell, all in a small generated reverb.
 * - Interface sounds: a light tick when the pointer or keyboard reaches a
 *   control, a soft tap on a click, air when a menu opens or closes, and a
 *   rising or falling pair of bells when sound is switched on or off.
 */
import type { Cue } from './sound';

interface Graph {
  context: AudioContext;
  /** Everything ends here, through a gentle limiter. */
  master: GainNode;
  /** Sent to the reverb. */
  space: GainNode;
  noise: AudioBuffer;
}

let graph: Graph | undefined;

/* -------------------------------------------------------------------------- */
/* The audio graph                                                            */
/* -------------------------------------------------------------------------- */

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

/** Builds the graph on the given context, once. */
export function attach(context: AudioContext) {
  if (graph?.context === context) return;

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

  graph = { context, master, space, noise: pinkNoise(context, 4) };
}

/* -------------------------------------------------------------------------- */
/* Ambient score                                                              */
/* -------------------------------------------------------------------------- */

let score: { stop(release: number): void } | undefined;

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

/** Starts the ambient score, if it is not already playing. It swells in over two seconds. */
export function startScore() {
  if (!graph || score) return;
  const g = graph;
  const { context } = g;
  const now = context.currentTime;
  const stops: (() => void)[] = [];

  const bus = context.createGain();
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(0.75, now + 2);
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
    const level = (0.055 / Math.sqrt(notes.length)) * (index < 2 ? 1.4 : 1);
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

  score = {
    stop(release) {
      window.clearTimeout(timer);
      const at = context.currentTime;
      bus.gain.cancelScheduledValues(at);
      bus.gain.setValueAtTime(bus.gain.value, at);
      bus.gain.linearRampToValueAtTime(0, at + release);
      window.setTimeout(() => {
        for (const stop of stops) {
          try {
            stop();
          } catch {
            // Already stopped.
          }
        }
        bus.disconnect();
      }, release * 1000 + 200);
    },
  };
}

/** Fades the ambient score out, over `release` seconds. */
export function stopScore(release = 1.2) {
  score?.stop(release);
  score = undefined;
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

/** Plays one interface sound. */
export function cue(name: Cue) {
  const g = graph;
  if (!g) return;
  const vary = 1 + (Math.random() - 0.5) * 0.06;
  switch (name) {
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
  }
}

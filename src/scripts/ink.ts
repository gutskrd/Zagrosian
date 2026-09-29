/**
 * The hero horseman, drawn in ink (WebGL).
 *
 * The emblem is redrawn as particles of ink: one for each small block of the
 * drawing that holds ink, as dark as the block is full, so at rest the
 * particles form the drawing exactly.
 *
 * - On arrival the ink gathers from the left, tail first, as the horseman
 *   rides in.
 * - Moving across the drawing blows the ink aside, like wind, before it
 *   settles back. A tap or click does the same where it lands.
 * - As the hero scrolls away, the ink loosens and drifts off, the drawing
 *   leaning back in relief: fuller parts stand further forward than the fine
 *   lines.
 *
 * With a mouse, the whole drawing also turns towards the pointer in 3D
 * (motion.ts), as a plane, so it stays crisp.
 *
 * The <img> stays underneath. It is what screen readers and printers get, and
 * the fallback. theme-init.js hides it (`data-ink`) only when motion is
 * welcome, data is not being saved and WebGL exists; if anything fails here,
 * the image comes back.
 *
 * Cost: frames are drawn only while something moves and the hero is on
 * screen, and the number of particles follows the device. Software-rendered
 * WebGL is declined, and so is any device that cannot keep up, so they keep
 * the still image.
 *
 * Security: no HTML is written, and styles are set through the CSSOM, which
 * the Content-Security-Policy allows.
 */

type InkState = 'pending' | 'loading' | 'ready' | 'off';

/** How far the canvas reaches past the drawing, as a share of its size. */
const BLEED_X = 0.14;
const BLEED_Y = 0.18;
/** Seconds until the last particle has arrived. */
const ARRIVAL = 2.1;
/** Gusts of wind held at once, and how long each lasts (ms). */
const GUSTS = 16;
const GUST_LIFE = 800;
const GUST_ATTACK = 90;

const VERTEX_SHADER = `
precision highp float;

attribute vec2 a_home;  // position in the drawing, in drawing widths from its centre
attribute vec3 a_ink;   // coverage, random seed, relief

uniform vec2 u_canvas;  // canvas size, CSS pixels
uniform float u_width;  // drawing width, CSS pixels
uniform float u_size;   // particle size at rest, device pixels
uniform float u_time;   // seconds since the ink began to gather
uniform float u_scatter;
uniform vec4 u_wind[${GUSTS}];  // x, y (CSS pixels from the centre), strength, radius
uniform int u_gusts;            // how many of them are blowing

varying float v_alpha;

float random(float n) {
  return fract(sin(n) * 43758.5453);
}

/** Turns a point about the horizontal axis through the drawing's centre. */
vec3 turn(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

void main() {
  float w = u_width;
  float seed = a_ink.y;
  float seed2 = random(seed * 91.7 + 3.1);
  float seed3 = random(seed * 47.3 + 1.3);

  // At rest: the drawing, in relief.
  vec3 rest = vec3(a_home * w, (a_ink.z - 0.5) * 0.18 * w);
  vec3 p = rest;

  // Arrival: from behind and to the left, tail first.
  float delay = (a_home.x + 0.5) * 0.55 + seed * 0.3;
  float t = clamp((u_time - delay) / 1.25, 0.0, 1.0);
  float arrived = 1.0 - pow(1.0 - t, 4.0);
  p += vec3(-(0.2 + 0.4 * seed2), (seed3 - 0.5) * 0.3, (seed - 0.75) * 0.8) * w * (1.0 - arrived);
  float alpha = a_ink.x * smoothstep(0.0, 0.35, t);

  // Wind from the pointer: ink is pushed outwards, swirls a little and lifts.
  // However strong the wind, no particle moves further than about an eighth
  // of the drawing, so it always settles back into the same place.
  vec3 push = vec3(0.0);
  for (int i = 0; i < ${GUSTS}; i++) {
    if (i >= u_gusts) break;
    vec4 gust = u_wind[i];
    if (gust.z <= 0.0) continue;
    vec2 d = p.xy - gust.xy;
    float force = gust.z * exp(-dot(d, d) / (gust.w * gust.w));
    vec2 away = d / (length(d) + 0.001 * w);
    vec2 across = vec2(-away.y, away.x) * (seed2 - 0.5);
    push += vec3((away * (0.35 + seed) + across) * 0.45, 0.2 + seed3 * 0.6) * force * gust.w;
  }
  p += push / (1.0 + length(push) / (0.12 * w));

  // Scrolling away: the ink loosens and drifts up.
  float s = u_scatter * u_scatter;
  p += vec3(seed2 - 0.5, -0.3 - seed, seed3 - 0.2) * s * w * 0.3;
  alpha *= 1.0 - s * seed * 0.8;

  // Lean back as the hero scrolls away.
  p = turn(p, u_scatter * 0.4);

  // Perspective, corrected so the drawing at rest is exact.
  float distance = 2.5 * w;
  float scale = distance / (distance - p.z);
  float restScale = distance / (distance - rest.z);
  vec2 screen = p.xy * scale - rest.xy * (restScale - 1.0);
  gl_Position = vec4(screen / (0.5 * u_canvas) * vec2(1.0, -1.0), 0.0, 1.0);
  gl_PointSize = max(1.0, u_size * scale / restScale);
  v_alpha = alpha;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform vec3 u_colour;
varying float v_alpha;

void main() {
  gl_FragColor = vec4(u_colour * v_alpha, v_alpha);
}
`;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const root = document.documentElement;
const setState = (state?: InkState) => {
  if (state) root.dataset.ink = state;
  else delete root.dataset.ink;
};

/** Particles the device can comfortably move, every frame. */
function particleBudget() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  // A drawing the full width of the hero holds about 50,000 pixels of ink,
  // or about 200,000 on a high-density screen: one particle each, where the
  // device allows.
  if (window.matchMedia('(pointer: coarse)').matches || memory < 4 || cores <= 2) return 90_000;
  return 240_000;
}

interface Particles {
  /** x, y, coverage, seed and relief for each particle. */
  data: Float32Array;
  count: number;
  /** Block size, in device pixels. */
  step: number;
  /** Size the drawing was sampled at, in device pixels. */
  width: number;
  height: number;
}

/** Samples the drawing into particles, at the size it is shown. */
function sample(image: HTMLImageElement, width: number, height: number, budget: number): Particles | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;

  // The amount of ink decides the block size: one pixel where the budget allows.
  let inked = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 8) inked++;
  if (inked === 0) return;
  const step = Math.max(1, Math.ceil(Math.sqrt(inked / budget)));
  const columns = Math.ceil(width / step);
  const rows = Math.ceil(height / step);

  // How full of ink each block is, from 0 to 1.
  const coverage = new Float32Array(columns * rows);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / step) * columns;
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha) coverage[row + Math.floor(x / step)] += alpha;
    }
  }
  const full = 255 * step * step;
  for (let i = 0; i < coverage.length; i++) coverage[i] = Math.min(1, coverage[i] / full);

  // Relief: how much ink surrounds each block (a summed-area table), and a
  // gentle roundness about the drawing's centre of mass.
  const stride = columns + 1;
  const table = new Float64Array(stride * (rows + 1));
  let mass = 0;
  let centreX = 0;
  let centreY = 0;
  for (let y = 0; y < rows; y++) {
    let line = 0;
    for (let x = 0; x < columns; x++) {
      const value = coverage[y * columns + x];
      line += value;
      table[(y + 1) * stride + x + 1] = table[y * stride + x + 1] + line;
      mass += value;
      centreX += value * x;
      centreY += value * y;
    }
  }
  centreX /= mass;
  centreY /= mass;

  const radius = Math.max(2, Math.round(columns * 0.035));
  const density = new Float32Array(columns * rows);
  let densest = 0;
  let farthest = 0;
  let count = 0;
  for (let y = 0; y < rows; y++) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(rows, y + radius + 1);
    for (let x = 0; x < columns; x++) {
      const index = y * columns + x;
      if (coverage[index] < 0.03) continue;
      const left = Math.max(0, x - radius);
      const right = Math.min(columns, x + radius + 1);
      const sum =
        table[bottom * stride + right] - table[top * stride + right] - table[bottom * stride + left] + table[top * stride + left];
      density[index] = sum / ((bottom - top) * (right - left));
      densest = Math.max(densest, density[index]);
      farthest = Math.max(farthest, Math.hypot(x - centreX, y - centreY));
      count++;
    }
  }

  const data = new Float32Array(count * 5);
  let offset = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const index = y * columns + x;
      if (coverage[index] < 0.03) continue;
      const round = 1 - (Math.hypot(x - centreX, y - centreY) / farthest) ** 2;
      data[offset++] = ((x + 0.5) * step) / width - 0.5;
      data[offset++] = ((y + 0.5) * step - height / 2) / width;
      data[offset++] = coverage[index];
      data[offset++] = Math.random();
      data[offset++] = 0.6 * (density[index] / densest) + 0.4 * round;
    }
  }

  return { data, count, step, width, height };
}

/**
 * True when WebGL is drawn by the processor instead of a graphics chip (a
 * blocked driver, a virtual machine, a headless browser): far too slow here.
 */
function isSoftware(gl: WebGLRenderingContext) {
  let renderer = String(gl.getParameter(gl.RENDERER));
  // Chrome and Safari give the actual renderer only through this extension.
  if (/^webkit webgl$/i.test(renderer)) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  }
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
}

function compile(gl: WebGLRenderingContext) {
  const shader = (type: number, source: string) => {
    const result = gl.createShader(type);
    if (!result) return null;
    gl.shaderSource(result, source);
    gl.compileShader(result);
    return gl.getShaderParameter(result, gl.COMPILE_STATUS) ? result : null;
  };
  const vertex = shader(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

export async function initInk() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-ink-canvas]');
  const art = canvas?.parentElement;
  const figure = art?.parentElement;
  const image = art?.querySelector('img');
  if (!canvas || !art || !figure || !image) return setState();

  // If the script was slow and the image has already appeared, the ink takes
  // its place without gathering again.
  const late = Number.parseFloat(getComputedStyle(image).opacity) > 0.01;
  if (!late) setState('loading');

  let shown = false;
  let stopped = false;
  let frameId = 0;
  let onScreen = true;
  const cleanups: (() => void)[] = [];
  const stop = (state?: InkState) => {
    if (stopped) return;
    stopped = true;
    if (frameId) cancelAnimationFrame(frameId);
    for (const cleanup of cleanups) cleanup();
    setState(state ?? (late || shown ? 'off' : undefined));
  };

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    failIfMajorPerformanceCaveat: true,
  });
  if (!gl || isSoftware(gl)) return stop();

  try {
    await image.decode();
  } catch {
    // decode() can reject for images that are already displayed.
  }
  if (!image.complete || image.naturalWidth === 0) return stop();

  /* ------------------------------------------------------------------------ */
  /* Graphics                                                                 */
  /* ------------------------------------------------------------------------ */

  let uniforms: Record<string, WebGLUniformLocation | null> = {};
  let particles: Particles | undefined;
  let buffer: WebGLBuffer | null = null;

  function setUp() {
    const program = compile(gl!);
    if (!program) return false;
    gl!.useProgram(program);
    uniforms = {};
    for (const name of ['u_canvas', 'u_width', 'u_size', 'u_time', 'u_scatter', 'u_wind', 'u_gusts', 'u_colour']) {
      uniforms[name] = gl!.getUniformLocation(program, name);
    }
    buffer = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    const home = gl!.getAttribLocation(program, 'a_home');
    const ink = gl!.getAttribLocation(program, 'a_ink');
    gl!.enableVertexAttribArray(home);
    gl!.vertexAttribPointer(home, 2, gl!.FLOAT, false, 20, 0);
    gl!.enableVertexAttribArray(ink);
    gl!.vertexAttribPointer(ink, 3, gl!.FLOAT, false, 20, 8);
    gl!.enable(gl!.BLEND);
    gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);
    gl!.clearColor(0, 0, 0, 0);
    if (particles) gl!.bufferData(gl!.ARRAY_BUFFER, particles.data, gl!.STATIC_DRAW);
    return true;
  }

  if (!setUp()) return stop();

  /* ------------------------------------------------------------------------ */
  /* Size                                                                     */
  /* ------------------------------------------------------------------------ */

  const budget = particleBudget();
  let ratio = 1;
  let artWidth = 0;
  let artHeight = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;

  function measure() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    // The layout size, to the fraction of a pixel, whatever the 3D turn.
    const style = getComputedStyle(art!);
    artWidth = Number.parseFloat(style.width) || 0;
    artHeight = Number.parseFloat(style.height) || 0;
    // Whole device pixels, so at rest each particle covers its own pixels.
    const width = Math.round(artWidth * (1 + 2 * BLEED_X) * ratio);
    const height = Math.round(artHeight * (1 + 2 * BLEED_Y) * ratio);
    canvasWidth = width / ratio;
    canvasHeight = height / ratio;
    if (canvas!.width !== width || canvas!.height !== height) {
      canvas!.width = width;
      canvas!.height = height;
    }
    canvas!.style.width = `${canvasWidth}px`;
    canvas!.style.height = `${canvasHeight}px`;
    canvas!.style.left = `${(artWidth - canvasWidth) / 2}px`;
    canvas!.style.top = `${(artHeight - canvasHeight) / 2}px`;
    gl!.viewport(0, 0, width, height);
  }

  /** True when the particles no longer match the drawing's size closely. */
  const stale = () =>
    !particles ||
    Math.abs(particles.width - artWidth * ratio) > 1 ||
    Math.abs(particles.height - artHeight * ratio) > 1;

  function resample() {
    const next = sample(image!, Math.round(artWidth * ratio), Math.round(artHeight * ratio), budget);
    if (!next) return false;
    particles = next;
    gl!.bufferData(gl!.ARRAY_BUFFER, particles.data, gl!.STATIC_DRAW);
    return true;
  }

  measure();
  if (artWidth < 1 || !resample()) return stop();

  /* ------------------------------------------------------------------------ */
  /* Motion                                                                   */
  /* ------------------------------------------------------------------------ */

  let scatter = 0;
  let time = late ? ARRIVAL : 0;
  let start: number | undefined;
  let previous: number | undefined;
  const intervals: number[] = [];

  interface Gust {
    x: number;
    y: number;
    strength: number;
    radius: number;
    born: number;
  }
  const gusts: Gust[] = [];
  const wind = new Float32Array(GUSTS * 4);

  const colour = () => (root.dataset.theme === 'dark' ? [1, 1, 1] : [0, 0, 0]);
  let ink = colour();

  /** The drawing's width on screen: exact to the device pixel when it matches the sample. */
  const drawingWidth = () =>
    particles && Math.abs(particles.width - artWidth * ratio) <= 1 ? particles.width / ratio : artWidth;

  function draw() {
    if (!particles) return;
    const width = drawingWidth();
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform2f(uniforms.u_canvas, canvasWidth, canvasHeight);
    gl!.uniform1f(uniforms.u_width, width);
    gl!.uniform1f(uniforms.u_size, (particles.step * width * ratio) / particles.width);
    gl!.uniform1f(uniforms.u_time, time);
    gl!.uniform1f(uniforms.u_scatter, scatter);
    gl!.uniform4fv(uniforms.u_wind, wind);
    gl!.uniform1i(uniforms.u_gusts, gusts.length);
    gl!.uniform3f(uniforms.u_colour, ink[0], ink[1], ink[2]);
    gl!.drawArrays(gl!.POINTS, 0, particles.count);
  }

  /** Writes the gusts' current strength; true while any wind is blowing. */
  function updateWind(now: number) {
    for (let i = gusts.length - 1; i >= 0; i--) {
      if (now - gusts[i].born >= GUST_LIFE) gusts.splice(i, 1);
    }
    wind.fill(0);
    gusts.forEach((gust, i) => {
      const age = now - gust.born;
      wind[i * 4] = gust.x;
      wind[i * 4 + 1] = gust.y;
      wind[i * 4 + 2] = gust.strength * smoothstep(0, GUST_ATTACK, age) * (1 - age / GUST_LIFE) ** 2;
      wind[i * 4 + 3] = gust.radius;
    });
    return gusts.length > 0;
  }

  /** Scrolling away loosens the ink; true when it changed. */
  function updateScatter() {
    // From when a third of the drawing has passed the top of the screen.
    const rect = figure!.getBoundingClientRect();
    const next = clamp(((window.innerHeight * 0.08 - rect.top) / rect.height - 0.3) / 0.7);
    const changed = Math.abs(next - scatter) > 0.0005;
    scatter = next;
    return changed;
  }

  const frame = (now: number) => {
    frameId = 0;
    if (stopped) return;
    start ??= now - time * 1000;
    time = (now - start) / 1000;

    // Should the device struggle while the ink gathers (under about 20
    // frames a second), the still image takes over.
    if (previous !== undefined && time < ARRIVAL && intervals.length < 12) {
      intervals.push(now - previous);
      if (intervals.length === 12 && intervals.sort((a, b) => a - b)[6] > 50) return stop('off');
    }

    const blowing = updateWind(now);
    const drifting = updateScatter();
    draw();

    if (!shown) {
      shown = true;
      setState('ready');
    }
    if (time < ARRIVAL || blowing || drifting) {
      previous = now;
      request();
    } else {
      previous = undefined;
    }
  };

  function request() {
    // The ink gathers once the opening screen has gone (intro.ts).
    if (!frameId && onScreen && !stopped && root.dataset.intro === undefined) frameId = requestAnimationFrame(frame);
  }
  document.addEventListener('intro:end', () => request(), { once: true });

  /* ------------------------------------------------------------------------ */
  /* Input                                                                    */
  /* ------------------------------------------------------------------------ */

  let lastGust: { x: number; y: number; time: number } | undefined;

  /** Adds a gust at a point in the window, if it is near the drawing. */
  function blow(clientX: number, clientY: number, strength: number, reach: number) {
    const rect = canvas!.getBoundingClientRect();
    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    const radius = drawingWidth() * 0.09 * reach;
    if (Math.abs(x) > rect.width / 2 + radius || Math.abs(y) > rect.height / 2 + radius) return;
    const gust = { x, y, strength, radius, born: performance.now() };
    if (gusts.length < GUSTS) gusts.push(gust);
    else {
      // Replace the oldest, which has the least strength left.
      let oldest = 0;
      gusts.forEach((candidate, i) => {
        if (candidate.born < gusts[oldest].born) oldest = i;
      });
      gusts[oldest] = gust;
    }
    request();
  }

  const listen = <K extends keyof WindowEventMap>(
    target: Window | HTMLElement,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, listener as EventListener, options);
    cleanups.push(() => target.removeEventListener(type, listener as EventListener, options));
  };

  listen(
    window,
    'pointermove',
    (event) => {
      if (!onScreen) return;
      // Wind follows the pointer's path, stronger the faster it moves.
      const now = performance.now();
      if (lastGust) {
        const distance = Math.hypot(event.clientX - lastGust.x, event.clientY - lastGust.y);
        const elapsed = Math.max(1, now - lastGust.time);
        if (distance < drawingWidth() * 0.035 && elapsed < 100) return;
        blow(event.clientX, event.clientY, clamp(0.2 + (distance / elapsed) * 0.35, 0.2, 0.85), 1);
      }
      lastGust = { x: event.clientX, y: event.clientY, time: now };
    },
    { passive: true },
  );

  listen(
    figure,
    'pointerdown',
    (event) => {
      blow(event.clientX, event.clientY, 1, 1.8);
    },
    { passive: true },
  );

  const leave = () => {
    lastGust = undefined;
  };
  root.addEventListener('pointerleave', leave);
  cleanups.push(() => root.removeEventListener('pointerleave', leave));

  listen(window, 'scroll', () => request(), { passive: true });

  // Only draw while the hero is on screen.
  const visibility = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) request();
    },
    { rootMargin: '10% 0px' },
  );
  visibility.observe(figure);
  cleanups.push(() => visibility.disconnect());

  // New size: redraw at once, and sample again once the size has settled.
  let resampleTimer = 0;
  const resize = () => {
    measure();
    draw();
    window.clearTimeout(resampleTimer);
    if (stale()) {
      resampleTimer = window.setTimeout(() => {
        if (!stopped && stale() && resample()) draw();
      }, 200);
    }
  };
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(art);
  cleanups.push(() => resizeObserver.disconnect());
  // Zooming changes the pixel ratio without always changing the size.
  listen(window, 'resize', () => {
    if (Math.min(window.devicePixelRatio || 1, 2) !== ratio) resize();
  });

  // Light and dark: the ink changes colour with the theme, in the same frame,
  // so it takes part in the theme transition.
  const themeObserver = new MutationObserver(() => {
    ink = colour();
    draw();
  });
  themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  cleanups.push(() => themeObserver.disconnect());

  // If the visitor asks for less motion while here, the still image returns.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionChange = () => {
    if (reducedMotion.matches) stop('off');
  };
  reducedMotion.addEventListener('change', onMotionChange);
  cleanups.push(() => reducedMotion.removeEventListener('change', onMotionChange));

  // The graphics processor can drop the context (a driver reset, or memory
  // pressure on phones). The image shows meanwhile, and the ink comes back
  // if the context does.
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    if (!stopped) setState('off');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (stopped || !setUp()) return stop('off');
    measure();
    draw();
    setState('ready');
  });

  request();
}

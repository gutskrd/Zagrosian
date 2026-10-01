/**
 * Water: moving the pointer over links, buttons, text and images stirs a
 * soft, clear liquid laid over the page, and what is under the pointer
 * wobbles as if seen through it.
 *
 * - The surface (WebGL 2) is a ripple simulation at a quarter of the screen's
 *   resolution. The pointer drops gentle ripples as it moves over something,
 *   a larger one where it arrives and a splash where it clicks; they spread,
 *   catch the light and settle within a few seconds, and they travel with
 *   the page as it scrolls. Only light and shade are drawn, so it reads as
 *   water in both themes. Nothing is drawn while the water is still.
 * - The wobble is an SVG displacement filter (`#liquid`, in BaseLayout.astro)
 *   on the element under the pointer, which flows while the pointer moves and
 *   eases away when it leaves or rests.
 *
 * Mouse and trackpad only (desktop.ts), and not with reduced motion or forced
 * colours. The surface is declined on software-rendered WebGL, without float
 * render targets, or when the device cannot keep up; the wobble works alone.
 *
 * Security: no HTML is written; elements are created with the DOM API, and
 * styles and attributes are set through the CSSOM and setAttribute.
 */

/** What the water answers to: things and text. */
const STIRS = 'a, button, summary, label, input, textarea, select, [role="button"], [data-magnetic], h1, h2, h3, h4, p, li, dt, dd, blockquote, figcaption, figure, img, .eyebrow';
/** What wobbles: text and controls small enough to filter every frame. */
const WOBBLES = 'a, button, summary, h1, h2, h3, h4, p, li, dt, dd, blockquote, figcaption, .eyebrow';
const WOBBLE_MAX_AREA = 360_000;

/** Simulation cells per CSS pixel, and the largest grid. */
const CELL = 4;
const MAX_CELLS = 640;
/** Drops held per frame, and how long the water runs after the last one (ms). */
const DROPS = 12;
const SETTLE = 3600;

const VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// One step of the wave equation (height now in R, a step ago in G), with
// damping, new drops, and the page's scroll since the last step.
const STEP = `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform ivec2 u_size;
uniform ivec2 u_shift;
uniform vec4 u_drops[${DROPS}];
uniform int u_count;
out vec4 o;

vec2 at(ivec2 p) {
  p += u_shift;
  if (p.x < 0 || p.y < 0 || p.x >= u_size.x || p.y >= u_size.y) return vec2(0.0);
  return texelFetch(u_state, p, 0).rg;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 here = at(p);
  float sum = at(p + ivec2(1, 0)).r + at(p - ivec2(1, 0)).r + at(p + ivec2(0, 1)).r + at(p - ivec2(0, 1)).r;
  float h = (sum * 0.5 - here.g) * 0.99;
  for (int i = 0; i < ${DROPS}; i++) {
    if (i >= u_count) break;
    vec4 d = u_drops[i];
    vec2 q = (gl_FragCoord.xy - d.xy) / d.z;
    h += d.w * exp(-dot(q, q));
  }
  o = vec4(h, here.r, 0.0, 1.0);
}`;

// The surface as light and shade: a highlight where it tilts towards the
// light, a shadow where it tilts away, nothing where it is flat.
const DRAW = `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform vec2 u_texel;
in vec2 v_uv;
out vec4 o;

void main() {
  float l = texture(u_state, v_uv - vec2(u_texel.x, 0.0)).r;
  float r = texture(u_state, v_uv + vec2(u_texel.x, 0.0)).r;
  float d = texture(u_state, v_uv - vec2(0.0, u_texel.y)).r;
  float u = texture(u_state, v_uv + vec2(0.0, u_texel.y)).r;
  vec3 n = normalize(vec3(l - r, d - u, 1.0));
  vec3 light = normalize(vec3(-0.3, 0.35, 0.89));
  // Both terms are zero on still water, so a still page is left untouched.
  float shade = dot(n, light) - light.z;
  // Thin glints where a ripple's slope turns the light towards the viewer,
  // like sun on water. Flat water reflects it away (mirror.z = light.z).
  float glint = smoothstep(0.94, 1.0, reflect(-light, n).z);
  float white = clamp(max(shade, 0.0) * 1.3 + glint * 0.28, 0.0, 0.4);
  float black = clamp(max(-shade, 0.0) * 1.1, 0.0, 0.2);
  o = vec4(vec3(white), white + black * (1.0 - white));
}`;

function isSoftware(gl: WebGL2RenderingContext) {
  let renderer = String(gl.getParameter(gl.RENDERER));
  // Chrome and Safari give the actual renderer only through this extension.
  if (/^webkit webgl$/i.test(renderer)) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  }
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
}

function compile(gl: WebGL2RenderingContext, fragment: string) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'a_position');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('water: shaders');
  return program;
}

type Drop = [x: number, y: number, radius: number, strength: number];

interface Surface {
  drop(x: number, y: number, radius: number, strength: number): void;
}

/** The ripple surface, or undefined where it is declined. */
function createSurface(): Surface | undefined {
  const canvas = document.createElement('canvas');
  canvas.className = 'water';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl || isSoftware(gl)) return undefined;
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return undefined;

  let step: WebGLProgram;
  let draw: WebGLProgram;
  try {
    step = compile(gl, STEP);
    draw = compile(gl, DRAW);
  } catch {
    return undefined;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uniforms = (program: WebGLProgram, names: string[]) =>
    Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
  const stepAt = uniforms(step, ['u_state', 'u_size', 'u_shift', 'u_drops', 'u_count']);
  const drawAt = uniforms(draw, ['u_state', 'u_texel']);

  // Two states, drawn into in turn.
  let width = 0;
  let height = 0;
  let states: { texture: WebGLTexture; buffer: WebGLFramebuffer }[] = [];
  let current = 0;

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2) / 2;
    canvas.width = Math.max(1, Math.round(window.innerWidth * ratio));
    canvas.height = Math.max(1, Math.round(window.innerHeight * ratio));
    const scale = Math.max(1, window.innerWidth / CELL / MAX_CELLS);
    width = Math.max(1, Math.round(window.innerWidth / CELL / scale));
    height = Math.max(1, Math.round(window.innerHeight / CELL / scale));
    for (const state of states) {
      gl.deleteTexture(state.texture);
      gl.deleteFramebuffer(state.buffer);
    }
    states = [0, 1].map(() => {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, width, height, 0, gl.RG, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const buffer = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { texture, buffer };
    });
  };

  // Drops waiting for the next step, in CSS pixels from the top left.
  const queue: Drop[] = [];
  let lastDrop = 0;
  let running = false;
  let failed = false;
  let scrolled = 0;
  let lastScroll = window.scrollY;
  const intervals: number[] = [];
  let lastFrame = 0;

  const clear = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  const frame = (now: number) => {
    if (failed) return;
    if (now - lastDrop > SETTLE) {
      running = false;
      clear();
      for (const state of states) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.buffer);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      return;
    }

    // A device that cannot keep up keeps a still page instead.
    if (lastFrame) {
      intervals.push(now - lastFrame);
      if (intervals.length > 12) intervals.shift();
      if (intervals.length === 12 && [...intervals].sort((a, b) => a - b)[6] > 50) {
        failed = true;
        canvas.remove();
        return;
      }
    }
    lastFrame = now;

    // The water travels with the page: scrolling down moves it up.
    scrolled += (window.scrollY - lastScroll) / (window.innerHeight / height);
    lastScroll = window.scrollY;
    const shift = Math.trunc(scrolled);
    scrolled -= shift;

    const drops = queue.splice(0, DROPS);
    const data = new Float32Array(DROPS * 4);
    const cellX = window.innerWidth / width;
    const cellY = window.innerHeight / height;
    drops.forEach(([x, y, radius, strength], i) => {
      data.set([x / cellX, height - y / cellY, Math.max(1, radius / cellX), strength], i * 4);
    });

    // Two steps a frame, so the rings spread at the pace of water.
    gl.disable(gl.BLEND);
    gl.useProgram(step);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(stepAt.u_state, 0);
    gl.uniform2i(stepAt.u_size, width, height);
    for (let pass = 0; pass < 2; pass++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, states[1 - current].buffer);
      gl.bindTexture(gl.TEXTURE_2D, states[current].texture);
      gl.uniform2i(stepAt.u_shift, 0, pass === 0 ? -shift : 0);
      gl.uniform4fv(stepAt.u_drops, data);
      gl.uniform1i(stepAt.u_count, pass === 0 ? drops.length : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      current = 1 - current;
    }

    gl.useProgram(draw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, states[current].texture);
    gl.uniform1i(drawAt.u_state, 0);
    gl.uniform2f(drawAt.u_texel, 1 / width, 1 / height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(frame);
  };

  canvas.addEventListener('webglcontextlost', () => {
    failed = true;
    canvas.remove();
  });
  window.addEventListener('resize', () => {
    if (!failed) resize();
  });

  resize();
  document.body.append(canvas);

  return {
    drop(x, y, radius, strength) {
      if (failed) return;
      queue.push([x, y, radius, strength]);
      if (queue.length > DROPS * 2) queue.splice(0, queue.length - DROPS * 2);
      lastDrop = performance.now();
      if (!running) {
        running = true;
        lastFrame = 0;
        intervals.length = 0;
        lastScroll = window.scrollY;
        scrolled = 0;
        requestAnimationFrame(frame);
      }
    },
  };
}

/** The wobble: the shared `#liquid` filter, moved to the element under the pointer. */
function createWobble() {
  const noise = document.querySelector<SVGFETurbulenceElement>('[data-liquid-noise]');
  const map = document.querySelector<SVGFEDisplacementMapElement>('[data-liquid-map]');
  if (!noise || !map) return undefined;

  let element: HTMLElement | undefined;
  let strength = 0;
  let target = 0;
  let peak = 4;
  let running = false;
  let time = 0;
  let last = 0;

  const release = () => {
    if (element) element.style.removeProperty('filter');
    element = undefined;
    map.setAttribute('scale', '0');
  };

  const frame = (now: number) => {
    const delta = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    time += delta;
    // Eases towards the target; the target itself fades while the pointer rests.
    strength += (target - strength) * Math.min(1, delta * 7);
    target *= Math.exp(-delta * 1.6);

    if (strength < 0.01 && target < 0.01) {
      running = false;
      last = 0;
      release();
      return;
    }
    // The noise drifts and breathes, so the distortion flows rather than shakes.
    const fx = 0.006 + 0.0015 * Math.sin(time * 1.1);
    const fy = 0.018 + 0.004 * Math.cos(time * 0.8);
    noise.setAttribute('baseFrequency', `${fx.toFixed(4)} ${fy.toFixed(4)}`);
    map.setAttribute('scale', (strength * peak).toFixed(2));
    requestAnimationFrame(frame);
  };

  return {
    /** Stirs `next` (or, with nothing under the pointer, lets the last one settle). */
    stir(next: HTMLElement | undefined, amount: number) {
      if (!next) {
        target = 0;
        return;
      }
      if (next !== element) {
        release();
        const box = next.getBoundingClientRect();
        if (box.width * box.height > WOBBLE_MAX_AREA) return;
        element = next;
        // Larger type ripples further.
        const size = parseFloat(getComputedStyle(next).fontSize) || 16;
        peak = Math.min(14, Math.max(4, size * 0.13));
        element.style.filter = 'url(#liquid)';
        strength = 0;
      }
      target = Math.min(1, target + amount);
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    },
  };
}

export function initWater() {
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(forced-colors: active)').matches
  ) {
    return;
  }

  // Created on the first movement, so a page that is only read costs nothing.
  let surface: Surface | undefined | null = null;
  let wobble: ReturnType<typeof createWobble> | null = null;
  let lastX = 0;
  let lastY = 0;
  let travelled = 0;
  let over: Element | null = null;

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      if (surface === null) surface = createSurface();
      if (wobble === null) wobble = createWobble();

      const target = event.target instanceof Element ? event.target : null;
      const thing = target?.closest(STIRS) ?? null;
      const distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);
      lastX = event.clientX;
      lastY = event.clientY;

      if (!thing) {
        over = null;
        wobble?.stir(undefined, 0);
        return;
      }

      // Arriving on something drops a larger ripple; moving over it, a soft
      // trail, one drop for every few pixels travelled.
      if (thing !== over) {
        over = thing;
        surface?.drop(event.clientX, event.clientY, 10, 1.6);
        travelled = 0;
      } else {
        travelled += distance;
        while (travelled > 22) {
          travelled -= 22;
          surface?.drop(event.clientX, event.clientY, 7, Math.min(0.8, 0.25 + distance * 0.015));
        }
      }
      wobble?.stir(target?.closest<HTMLElement>(WOBBLES) ?? undefined, Math.min(0.5, 0.08 + distance * 0.012));
    },
    { passive: true },
  );

  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'mouse' || !surface) return;
      surface.drop(event.clientX, event.clientY, 16, 2.6);
    },
    { passive: true },
  );

  document.documentElement.addEventListener('pointerleave', () => {
    over = null;
    wobble?.stir(undefined, 0);
  });
}

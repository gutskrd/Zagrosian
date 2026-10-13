/**
 * The kilim in 3D (Rug.astro), drawn with WebGL 2: a rug of wool hanging in
 * the light, which unrolls as it scrolls into view and leans towards the
 * pointer, as Apple TV's posters do, with a soft glare that follows it.
 *
 * - The rug is one sheet, 40 by 220 quads. Above the line it has unrolled to
 *   it hangs flat; below it the rest is wound in a spiral, its pattern outward
 *   (the vertex shader). Scrolling down unrolls it, scrolling up rolls it up.
 * - Its pattern is the drawing in rug.ts (scripts/kilim.mjs), one texel a cell.
 *   The fragment shader weaves it: each cell is two passes of weft over two
 *   warps, each pass a row of small rounded pips that catch the light, with
 *   woolly edges between the colours, a little variation from strand to
 *   strand and in the dye, and a sheen at grazing angles. Where the pips are
 *   smaller than a pixel they fade out, so they never shimmer.
 * - Plain bands close both ends, and the warp hangs from the foot as a fringe,
 *   which swings when the rug moves.
 * - It casts a soft shadow on the page behind it.
 *
 * Frames are drawn only while something changes, and only while the rug is on
 * screen. For visitors who prefer reduced motion it hangs unrolled and still.
 */
import { rugCells } from '../assets/kilim/rug';

const COLUMNS = rugCells[0].length;
const ROWS = rugCells.length;
/** Plain bands at either end and the fringe, in cells. */
const END = 2;
const FRINGE = 7;
const ALL_ROWS = END + ROWS + END + FRINGE;
/** In units of the rug's width. */
const LENGTH = ALL_ROWS / COLUMNS;
const FRINGE_START = (ALL_ROWS - FRINGE) / COLUMNS;
const THICKNESS = 0.0105;
const CORE = 0.018;

const vertexShader = /* glsl */ `#version 300 es
precision highp float;
in vec2 aUv;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uLength;
uniform float uFlat;
uniform float uOuter;
uniform float uThickness;
uniform float uFringeStart;
uniform vec2 uSway;
out vec2 vUv;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vAlong;
const float PI = 3.14159265;

void main() {
  float x = aUv.x - 0.5;
  float s = aUv.y * uLength;
  vec3 p;
  vec3 n;
  vec3 t;
  if (s <= uFlat) {
    // Hanging: a slight, even waviness, none at the top where it is held.
    float hold = smoothstep(0.0, 0.25, s);
    float wave = 0.006 * hold * sin(x * 7.0 + s * 2.3) * sin(s * 4.1 + 0.6);
    p = vec3(x, -s, wave);
    n = normalize(vec3(-0.006 * hold * 7.0 * cos(x * 7.0 + s * 2.3) * sin(s * 4.1 + 0.6), 0.0, 1.0));
    t = vec3(0.0, -1.0, 0.0);
    // The fringe swings from its knots.
    if (s > uFringeStart) {
      float d = (s - uFringeStart) / (uLength - uFringeStart);
      p.x += uSway.x * d * d;
      p.z += uSway.y * d * d;
    }
  } else {
    // Wound up: the sheet runs round a spiral, a thickness further in each turn.
    float l = s - uFlat;
    float r = sqrt(max(uOuter * uOuter - uThickness * l / PI, 1e-6));
    float a = 2.0 * PI * (uOuter - r) / uThickness;
    p = vec3(x, -uFlat - r * sin(a), r * cos(a) - uOuter);
    n = vec3(0.0, -sin(a), cos(a));
    t = vec3(0.0, -cos(a), -sin(a));
  }
  vec4 world = uModel * vec4(p, 1.0);
  vUv = aUv;
  vWorld = world.xyz;
  vNormal = mat3(uModel) * n;
  vAlong = mat3(uModel) * t;
  gl_Position = uProjection * uView * world;
}`;

const fragmentShader = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vAlong;
uniform sampler2D uCells;
uniform vec2 uGrid;
uniform float uRows;
uniform float uEnd;
uniform float uFringe;
uniform vec3 uAcross;
uniform vec3 uCamera;
uniform vec3 uLight;
uniform vec3 uGlare;
out vec4 outColor;
const float PI = 3.14159265;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 toScreen(vec3 linear) {
  return pow(clamp(linear, 0.0, 1.0), vec3(1.0 / 2.2));
}

// Light from the upper left, wrapped round the wool's fibres, a soft
// highlight, and a sheen where the surface turns away.
vec3 light(vec3 base, vec3 n, vec3 v, float occlusion) {
  vec3 l = normalize(uLight);
  float diffuse = max((dot(n, l) + 0.45) / 1.45, 0.0);
  vec3 h = normalize(l + v);
  float highlight = pow(max(dot(n, h), 0.0), 24.0) * 0.05;
  float sheen = pow(1.0 - max(dot(n, v), 0.0), 4.0) * 0.12;
  return base * (0.2 + 0.95 * diffuse) * occlusion + highlight + sheen * vec3(0.8);
}

void main() {
  vec3 v = normalize(uCamera - vWorld);
  vec3 n = normalize(vNormal);
  vec3 along = normalize(vAlong);
  if (!gl_FrontFacing) {
    n = -n;
  }
  float cx = vUv.x * uGrid.x;
  float cy = vUv.y * uRows;
  float woven = uRows - uFringe;
  vec3 wool = vec3(0.74, 0.71, 0.65);

  // The fringe: two threads to a cell, of uneven length, round in section.
  if (cy > woven) {
    float d = (cy - woven) / uFringe;
    float k = cx * 2.0;
    float id = floor(k);
    float end = 0.72 + 0.28 * hash(vec2(id, 7.0));
    float across = fract(k + 0.05 * sin(cy * 1.9 + id * 2.1)) - 0.5;
    float half_ = 0.34 - 0.08 * d;
    float edge = fwidth(k);
    float coverage = (1.0 - smoothstep(half_ - edge, half_ + edge, abs(across))) * (1.0 - smoothstep(end - 0.02, end, d));
    if (coverage < 0.01) discard;
    float q = clamp(across / half_, -1.0, 1.0);
    vec3 round_ = normalize(n * sqrt(1.0 - q * q) + normalize(uAcross) * q);
    // A knot where the fringe leaves the weave.
    float knot = d < 0.14 ? 0.85 : 1.0;
    vec3 colour = light(wool * (0.9 + 0.1 * hash(vec2(id, 3.0))) * knot, round_, v, 1.0);
    outColor = vec4(toScreen(colour) * coverage, coverage);
    return;
  }

  // Which colour this point is woven in, from a slightly shaken point, so the
  // edges between colours are woolly rather than ruled.
  vec2 jitter = (vec2(noise(vec2(cx, cy) * 5.0), noise(vec2(cy, cx) * 5.0 + 3.7)) - 0.5) * 0.22;
  vec2 cell = vec2(cx, cy - uEnd) + jitter;
  float ink = 0.0;
  if (cell.y >= 0.0 && cell.y < uGrid.y) {
    ink = texelFetch(uCells, ivec2(clamp(floor(cell), vec2(0.0), uGrid - 1.0)), 0).r;
  } else {
    // The plain ends, each with one thin dark stripe.
    float e = cell.y < 0.0 ? -cell.y : cell.y - uGrid.y;
    ink = step(0.75, e) * step(e, 1.1);
  }

  // The weave: two passes of weft a cell, each over every other warp, offset
  // from the pass before; each pip is rounded along and across.
  float py = cy * 2.0;
  float pass = floor(py);
  float px = cx * 2.0 + 0.5 * mod(pass, 2.0);
  float u = fract(px);
  float w = fract(py);
  float su = sin(PI * u);
  float sw = sin(PI * w);
  float height = su * sw;
  // Where the pips come closer than about six pixels apart they fade into
  // their average, so they never beat against the screen's pixels.
  float detail = 1.0 - smoothstep(0.14, 0.32, max(fwidth(py), fwidth(px)));
  vec3 slope = (PI * cos(PI * u) * sw) * normalize(uAcross) + (PI * su * cos(PI * w)) * along;
  vec3 bumped = normalize(n - 0.22 * detail * slope);
  // Shade in the hollows between pips; 0.405 is the pips' mean height.
  float occlusion = 1.0 - 0.28 * (1.0 - mix(0.405, height, detail));

  // Undyed wool and a near-black, each strand a little different, and the dye
  // a little uneven along the rug, as in a rug woven by hand.
  vec3 ground = vec3(0.70, 0.68, 0.63);
  vec3 dark = vec3(0.012, 0.0115, 0.011);
  float strand = hash(vec2(floor(px), pass));
  float dye = noise(vec2(cx * 0.12, cy * 0.09)) * 0.6 + noise(vec2(3.0, cy * 0.4)) * 0.4;
  vec3 base = mix(ground, dark, ink) * (0.9 + 0.12 * dye + 0.08 * (strand - 0.5));
  if (!gl_FrontFacing) {
    base *= 0.82;
  }

  vec3 colour = light(base, bumped, v, occlusion);
  // The glare that follows the pointer, broad and soft.
  vec2 g = (vUv - uGlare.xy) * vec2(1.0, uRows / uGrid.x);
  colour += uGlare.z * 0.2 * exp(-dot(g, g) / 0.14);
  outColor = vec4(toScreen(colour), 1.0);
}`;

const shadowVertexShader = /* glsl */ `#version 300 es
precision highp float;
in vec2 aUv;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec2 uExtent;
uniform float uWall;
uniform vec2 uOffset;
out vec2 vLocal;
void main() {
  // A rectangle a little larger than the rug, for the blur, laid on the wall.
  vec2 local = vec2(mix(-0.5 - 0.25, 0.5 + 0.25, aUv.x), mix(0.25, -uExtent.y - 0.25, aUv.y));
  vec4 world = uModel * vec4(local, 0.0, 1.0);
  world.z = uWall;
  world.xy += uOffset;
  vLocal = local;
  gl_Position = uProjection * uView * world;
}`;

const shadowFragmentShader = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
uniform vec2 uExtent;
uniform float uStrength;
out vec4 outColor;
void main() {
  // A soft-edged box: the rug's outline, blurred.
  float blur = 0.16;
  float x = smoothstep(0.5 + blur, 0.5 - blur, abs(vLocal.x));
  float top = smoothstep(blur, -blur, vLocal.y);
  float bottom = smoothstep(-uExtent.y - blur, -uExtent.y + blur, vLocal.y);
  float a = x * top * bottom * uStrength;
  outColor = vec4(0.0, 0.0, 0.0, a);
}`;

type Matrix = Float32Array;

const perspective = (fov: number, aspect: number, near: number, far: number): Matrix => {
  const f = 1 / Math.tan(fov / 2);
  const range = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (near + far) * range, -1, 0, 0, 2 * near * far * range, 0]);
};

const multiply = (a: Matrix, b: Matrix): Matrix => {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
};

const translation = (x: number, y: number, z: number): Matrix =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);

const rotationX = (angle: number): Matrix => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
};

const rotationY = (angle: number): Matrix => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
};

function program(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    return shader;
  };
  const built = gl.createProgram()!;
  gl.attachShader(built, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(built, compile(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(built, 0, 'aUv');
  gl.linkProgram(built);
  if (!gl.getProgramParameter(built, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(built) ?? 'program');
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const at = (name: string) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(built, name));
    return uniforms.get(name)!;
  };
  return { program: built, at };
}

/** A grid of points over the unit square, as triangles. */
function sheet(gl: WebGL2RenderingContext, across: number, along: number) {
  const points = new Float32Array((across + 1) * (along + 1) * 2);
  let i = 0;
  for (let y = 0; y <= along; y++) {
    for (let x = 0; x <= across; x++) {
      points[i++] = x / across;
      points[i++] = y / along;
    }
  }
  const indices = new Uint16Array(across * along * 6);
  i = 0;
  for (let y = 0; y < along; y++) {
    for (let x = 0; x < across; x++) {
      const a = y * (across + 1) + x;
      const b = a + across + 1;
      indices.set([a, b, a + 1, a + 1, b, b + 1], i);
      i += 6;
    }
  }
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: indices.length };
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Draws the rug into the stage's canvas. Returns false where WebGL 2 is not
 * available, and the flat rug stays.
 */
export function mountRug(stage: HTMLElement): boolean {
  const canvas = stage.querySelector<HTMLCanvasElement>('canvas');
  // Smoothed edges where pixels are large; on denser screens the pixels are
  // fine enough, and multisampling would cost several times the memory.
  const gl = canvas?.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: (window.devicePixelRatio || 1) < 1.5,
    powerPreference: 'low-power',
  });
  if (!canvas || !gl) return false;

  let rug: ReturnType<typeof program>;
  let shadow: ReturnType<typeof program>;
  try {
    rug = program(gl, vertexShader, fragmentShader);
    shadow = program(gl, shadowVertexShader, shadowFragmentShader);
  } catch {
    return false;
  }
  const cloth = sheet(gl, 40, 220);
  const quad = sheet(gl, 1, 1);

  // The pattern, one texel a cell: 1 where it is woven in ink.
  const texels = new Uint8Array(COLUMNS * ROWS);
  rugCells.forEach((row, y) => [...row].forEach((cell, x) => (texels[y * COLUMNS + x] = cell === '#' ? 255 : 0)));
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, COLUMNS, ROWS, 0, gl.RED, gl.UNSIGNED_BYTE, texels);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  // What the rug is doing, and what it is easing towards.
  const rest = { yaw: -0.2, pitch: 0.06 };
  const target = { yaw: rest.yaw, pitch: rest.pitch, glare: 0.35, gx: 0.28, gy: 0.18 };
  const now = { ...target, unrolled: 0 };
  let sway = { x: 0, z: 0, vx: 0, vz: 0 };
  let width = 0;
  let height = 0;
  let onScreen = false;
  let frame = 0;
  let last = 0;
  let shadowStrength = 0.3;

  const readTheme = () => {
    shadowStrength = document.documentElement.dataset.theme === 'dark' ? 0.7 : 0.26;
  };
  readTheme();

  /** How far the rug has unrolled, from its place on the screen. */
  const unrolledFromScroll = () => {
    if (still.matches) return 1;
    const box = stage.getBoundingClientRect();
    const view = document.documentElement.clientHeight;
    const start = view * 0.95;
    const end = Math.max(view - box.height, 0) + view * 0.05;
    return smooth(clamp((start - box.top) / Math.max(start - end, 1)));
  };

  /** A gentle lean with the scroll, so it is never quite flat to the screen. */
  const leanFromScroll = () => {
    if (still.matches) return 0;
    const box = stage.getBoundingClientRect();
    const view = document.documentElement.clientHeight;
    return clamp((box.top + box.height / 2) / view, -0.5, 1.5) - 0.5;
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  const draw = () => {
    const aspect = width / height;
    const fov = 0.5;
    // Far enough back that the whole rug and its lean fit, with a margin.
    const distance = Math.max((LENGTH * 1.08) / (2 * Math.tan(fov / 2)), 1.32 / (2 * Math.tan(fov / 2) * aspect));
    const projection = perspective(fov, aspect, 0.1, 20);
    const camera: [number, number, number] = [0, 0, distance];
    const view = translation(0, 0, -distance);
    const lean = leanFromScroll();
    const model = multiply(
      multiply(rotationY(now.yaw), rotationX(now.pitch + lean * 0.12)),
      translation(0, LENGTH / 2, 0),
    );
    const flat = now.unrolled * LENGTH;
    const outer = Math.sqrt(CORE * CORE + (THICKNESS * (LENGTH - flat)) / Math.PI);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // The shadow on the page behind, down and to the right of the rug.
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(shadow.program);
    gl.uniformMatrix4fv(shadow.at('uProjection'), false, projection);
    gl.uniformMatrix4fv(shadow.at('uView'), false, view);
    gl.uniformMatrix4fv(shadow.at('uModel'), false, model);
    gl.uniform2f(shadow.at('uExtent'), 1, flat + outer * 1.6);
    gl.uniform1f(shadow.at('uWall'), -0.32);
    gl.uniform2f(shadow.at('uOffset'), 0.05 - now.yaw * 0.1, -0.07);
    gl.uniform1f(shadow.at('uStrength'), shadowStrength);
    gl.bindVertexArray(quad.vao);
    gl.drawElements(gl.TRIANGLES, quad.count, gl.UNSIGNED_SHORT, 0);

    // The rug.
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(rug.program);
    gl.uniformMatrix4fv(rug.at('uProjection'), false, projection);
    gl.uniformMatrix4fv(rug.at('uView'), false, view);
    gl.uniformMatrix4fv(rug.at('uModel'), false, model);
    gl.uniform1f(rug.at('uLength'), LENGTH);
    gl.uniform1f(rug.at('uFlat'), flat);
    gl.uniform1f(rug.at('uOuter'), outer);
    gl.uniform1f(rug.at('uThickness'), THICKNESS);
    gl.uniform1f(rug.at('uFringeStart'), FRINGE_START);
    gl.uniform2f(rug.at('uSway'), sway.x, sway.z);
    gl.uniform2f(rug.at('uGrid'), COLUMNS, ROWS);
    gl.uniform1f(rug.at('uRows'), ALL_ROWS);
    gl.uniform1f(rug.at('uEnd'), END);
    gl.uniform1f(rug.at('uFringe'), FRINGE);
    gl.uniform3f(rug.at('uAcross'), model[0], model[1], model[2]);
    gl.uniform3f(rug.at('uCamera'), ...camera);
    gl.uniform3f(rug.at('uLight'), -0.45, 0.55, 0.75);
    gl.uniform3f(rug.at('uGlare'), now.gx, now.gy, now.glare);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(rug.at('uCells'), 0);
    gl.bindVertexArray(cloth.vao);
    gl.drawElements(gl.TRIANGLES, cloth.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  };

  /** One step: everything eases towards where it is going; true while it moves. */
  const step = (time: number) => {
    const dt = Math.min((time - (last || time)) / 1000, 1 / 20);
    last = time;
    const ease = 1 - Math.exp(-dt * 7);
    const before = { yaw: now.yaw, unrolled: now.unrolled };
    const unrolled = unrolledFromScroll();
    now.unrolled += (unrolled - now.unrolled) * (still.matches ? 1 : 1 - Math.exp(-dt * 14));
    for (const key of ['yaw', 'pitch', 'glare', 'gx', 'gy'] as const) now[key] += (target[key] - now[key]) * ease;

    // The fringe: a damped swing, pushed by the rug's turning and settling.
    if (dt > 0) {
      const push = ((now.yaw - before.yaw) / dt) * 0.02;
      const drop = ((now.unrolled - before.unrolled) / dt) * 0.01;
      sway.vx += (-sway.x * 60 - sway.vx * 6) * dt - push * 0.5;
      sway.vz += (-sway.z * 60 - sway.vz * 6) * dt + drop;
      sway.x += sway.vx * dt;
      sway.z += sway.vz * dt;
      sway.x = clamp(sway.x, -0.06, 0.06);
      sway.z = clamp(sway.z, -0.06, 0.06);
    }
    draw();
    const moving =
      Math.abs(unrolled - now.unrolled) > 0.0005 ||
      Math.abs(target.yaw - now.yaw) > 0.0005 ||
      Math.abs(target.pitch - now.pitch) > 0.0005 ||
      Math.abs(target.glare - now.glare) > 0.002 ||
      Math.abs(sway.vx) + Math.abs(sway.vz) + Math.abs(sway.x) + Math.abs(sway.z) > 0.0004;
    if (!moving) sway = { x: 0, z: 0, vx: 0, vz: 0 };
    return moving;
  };

  // When it comes to rest, how far it has unrolled (for the tests).
  const settle = () => {
    last = 0;
    stage.dataset.unrolled = now.unrolled.toFixed(2);
  };

  const loop = (time: number) => {
    frame = 0;
    if (!onScreen || document.hidden) return;
    if (step(time)) frame = requestAnimationFrame(loop);
    else settle();
  };

  const wake = () => {
    if (!frame && onScreen) frame = requestAnimationFrame(loop);
  };

  // Leaning towards the pointer, with the glare under it.
  const point = (event: PointerEvent) => {
    if (still.matches || (event.pointerType === 'mouse' && !fine.matches)) return;
    const box = stage.getBoundingClientRect();
    const x = clamp((event.clientX - box.left) / box.width) - 0.5;
    const y = clamp((event.clientY - box.top) / box.height) - 0.5;
    target.yaw = rest.yaw * 0.4 + x * 0.55;
    target.pitch = rest.pitch + y * 0.35;
    target.gx = x + 0.5;
    target.gy = y + 0.5;
    target.glare = 1;
    wake();
  };
  const leave = () => {
    Object.assign(target, { yaw: rest.yaw, pitch: rest.pitch, glare: 0.35, gx: 0.28, gy: 0.18 });
    wake();
  };
  stage.addEventListener('pointermove', point);
  stage.addEventListener('pointerdown', point);
  stage.addEventListener('pointerleave', leave);
  stage.addEventListener('pointerup', (event) => event.pointerType !== 'mouse' && leave());
  stage.addEventListener('pointercancel', leave);

  window.addEventListener('scroll', wake, { passive: true });
  new ResizeObserver(() => {
    resize();
    if (onScreen) draw();
    wake();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    wake();
  }).observe(stage);
  new MutationObserver(() => {
    readTheme();
    wake();
    if (onScreen) draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  still.addEventListener('change', wake);
  document.addEventListener('visibilitychange', wake);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stage.removeAttribute('data-live');
  });

  resize();
  now.unrolled = unrolledFromScroll();
  draw();
  settle();
  stage.setAttribute('data-live', '');
  return true;
}

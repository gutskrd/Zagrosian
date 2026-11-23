/**
 * WebGL 2 rug that can be picked up, folded, dragged and dropped like cloth.
 *
 * - Simulation: cloth.ts (particle grid). Positions and normals are uploaded each frame as two
 *   small float textures; a 4x denser mesh samples them with Catmull-Rom interpolation so folds
 *   stay smooth.
 * - Shading: the woven image (scripts/rug.mjs) as a mipmapped texture, plus procedural pile,
 *   per-knot variation and wool sheen.
 * - Lighting: one large soft key light from the upper left. A shadow map gives contact-hardening
 *   (PCSS) shadows on the floor and self-shadowing between folds.
 * - At rest the nearest corner is slightly curled. The rest pose is simulated off-screen in small
 *   time slices before the rug is shown, so nothing settles in view.
 * - Input: mouse drag. On touch, a long press or a horizontal start grabs the rug so vertical
 *   swipes still scroll; a tap lifts the corner, like the button.
 *
 * The render loop runs only while something moves. After interaction the pose is reset once the rug
 * is out of view. Reduced motion keeps it flat and static.
 */
import rugPicture from '../../assets/rug/rug.webp?url';
import { modest, pixelRatio } from '../utils/device';
import { clamp } from '../utils/math';
import { Cloth } from './cloth';

/**
 * Woven image layout in 2x2-knot cells (scripts/rug.mjs): width, length, and the fringe at each
 * end.
 */
const CELLS_ACROSS = 101;
const WEAVE_ROWS = 161;
const FRINGE = 6;
const COLUMNS = 29;
const CELLS_ALONG = WEAVE_ROWS + 2 * FRINGE;
const ROWS = Math.round((COLUMNS - 1) * (CELLS_ALONG / CELLS_ACROSS)) + 1;
const SUBDIVIDE = 4;
/**
 * The rug's share of the stage width and its resting angle come from CSS (`--rug-share`,
 * `--rug-angle` in Rug.astro), so the fallback image, the paper plane and this scene stay aligned.
 */
const cssNumber = (element: HTMLElement, name: string, fallback: number) => {
  const value = parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
};
const LIFT = 0.1;
/** Corner curl height at rest, and the height it rises to when the pointer approaches. */
const CURL = 0.065;
const CURL_NEAR = 0.11;
const STEP = 1 / 60;

const surface = /* glsl */ `
uniform highp sampler2D uPositions;
uniform highp sampler2D uNormals;
uniform ivec2 uGrid;

vec3 catmullRom(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  return 0.5 * (2.0 * b + (c - a) * t + (2.0 * a - 5.0 * b + 4.0 * c - d) * t * t + (3.0 * b - a - 3.0 * c + d) * t * t * t);
}

vec3 grid(highp sampler2D values, ivec2 at) {
  return texelFetch(values, clamp(at, ivec2(0), uGrid - 1), 0).xyz;
}

// Cloth position at a point between particles: bicubic Catmull-Rom over the nearest 4x4.
vec3 smoothly(highp sampler2D values, vec2 uv) {
  vec2 g = uv * vec2(uGrid - 1);
  ivec2 i = min(ivec2(floor(g)), uGrid - 2);
  vec2 f = g - vec2(i);
  vec3 rows[4];
  for (int y = 0; y < 4; y++) {
    ivec2 r = i + ivec2(0, y - 1);
    rows[y] = catmullRom(grid(values, r + ivec2(-1, 0)), grid(values, r), grid(values, r + ivec2(1, 0)), grid(values, r + ivec2(2, 0)), f.x);
  }
  return catmullRom(rows[0], rows[1], rows[2], rows[3], f.y);
}
`;

const rugVertex = /* glsl */ `#version 300 es
precision highp float;
in vec2 aUv;
uniform mat4 uViewProjection;
${surface}
out vec2 vUv;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec3 world = smoothly(uPositions, aUv);
  vUv = aUv;
  vWorld = world;
  vNormal = smoothly(uNormals, aUv);
  gl_Position = uViewProjection * vec4(world, 1.0);
}`;

// Depth-only pass for the shadow map.
const depthFragment = /* glsl */ `#version 300 es
precision highp float;
void main() {}`;

/**
 * Late-afternoon window light: two warm, soft-edged beams split by the mullion's shadow, brightest
 * near the window. Points above the floor are projected back along the light direction, so the
 * beams wrap over lifted cloth.
 */
const sunlight = /* glsl */ `
uniform vec3 uToLight;
float speck(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// Value noise for the wool mottle (rugFragment).
float mottle(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(speck(i), speck(i + vec2(1.0, 0.0)), f.x), mix(speck(i + vec2(0.0, 1.0)), speck(i + vec2(1.0, 1.0)), f.x), f.y);
}
// x: coverage by the window's light patch; y: beam intensity at that point.
vec2 windowParts(vec3 p) {
  vec2 q = p.xz - uToLight.xz / uToLight.y * p.y;
  // Coordinates along the light (beams are stretched that way) and across it.
  vec2 along = normalize(-uToLight.xz);
  vec2 across = vec2(-along.y, along.x);
  vec2 c = q - vec2(0.02, 0.04);
  float a = dot(c, along);
  float b = dot(c, across);
  float pool = (1.0 - smoothstep(0.3, 1.3, abs(a + 0.1))) * (1.0 - smoothstep(0.25, 0.85, abs(b)));
  float beams = max(1.0 - smoothstep(0.08, 0.26, abs(a + 0.2)), 0.85 * (1.0 - smoothstep(0.06, 0.22, abs(a - 0.32))));
  return vec2(pool, beams);
}
float window(vec3 p) {
  vec2 w = windowParts(p);
  return w.x * w.y;
}
`;

/** 16 evenly distributed sample offsets on a disc, for soft shadows. */
const disc = /* glsl */ `
const vec2 DISC[16] = vec2[](
  vec2(-0.94, -0.40), vec2(0.95, -0.77), vec2(-0.09, -0.93), vec2(0.34, 0.29),
  vec2(-0.92, 0.46), vec2(-0.82, 0.15), vec2(-0.38, 0.28), vec2(-0.20, -0.04),
  vec2(0.97, 0.19), vec2(0.44, -0.40), vec2(0.54, 0.75), vec2(-0.26, 0.96),
  vec2(0.79, 0.53), vec2(0.14, -0.38), vec2(-0.66, -0.73), vec2(0.21, 0.67)
);
`;

const rugFragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vWorld;
in vec3 vNormal;
uniform sampler2D uWeave;
uniform highp sampler2DShadow uShadow;
uniform mat4 uLight;
uniform vec3 uEye;
uniform vec2 uCells;
out vec4 outColor;
const float PI = 3.14159265;
${disc}
${sunlight}

void main() {
  vec4 wool = texture(uWeave, vUv);
  if (wool.a < 0.45) discard;
  vec3 base = pow(wool.rgb / wool.a, vec3(2.2));
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) {
    n = -n;
    // Back side of a pile rug: same pattern, flatter and duller.
    base *= 0.78;
  }

  // Knot highlights: two passes per cell over two warps, matching the texture; faded out where
  // they'd be sub-pixel.
  vec2 cell = vUv * uCells;
  float py = cell.y * 2.0;
  float pass = floor(py);
  float px = cell.x * 2.0 + 0.5 * mod(pass, 2.0);
  float u = fract(px);
  float w = fract(py);
  float detail = 1.0 - smoothstep(0.18, 0.4, max(fwidth(px), fwidth(py)));
  vec3 across = normalize(dFdx(vWorld) * dFdx(cell.x) + dFdy(vWorld) * dFdy(cell.x) + vec3(1e-6));
  vec3 along = normalize(cross(n, across));
  vec3 slope = PI * cos(PI * u) * sin(PI * w) * across + PI * sin(PI * u) * cos(PI * w) * along;
  vec3 bumped = normalize(n - 0.18 * detail * slope);
  // Pile: per-knot brightness variation (faded out where knots are sub-pixel), plus a fine mottle
  // about a cell across, as tufts lie in different directions.
  float tuft = fract(sin(dot(floor(cell * 2.0), vec2(12.9898, 78.233))) * 43758.5453);
  base *= mix(1.0, 0.88 + 0.2 * tuft, detail);
  float fine = 1.0 - smoothstep(0.7, 1.6, max(fwidth(cell.x), fwidth(cell.y)));
  base *= mix(1.0, 0.93 + 0.14 * mottle(cell * 0.85), fine);

  // Self-shadowing from folds above.
  vec4 l = uLight * vec4(vWorld + n * 0.006, 1.0);
  vec3 s = l.xyz / l.w * 0.5 + 0.5;
  float lit = 0.0;
  for (int i = 0; i < 8; i++) lit += texture(uShadow, vec3(s.xy + DISC[i * 2] * 0.0035, s.z - 0.0015));
  lit /= 8.0;

  vec3 toLight = normalize(uToLight);
  vec3 v = normalize(uEye - vWorld);
  // Direct light only within the window beams.
  float beam = window(vWorld);
  // Wrapped diffuse: wool is matte and fuzzy, so light wraps around folds and there's no specular.
  float sun = clamp(dot(bumped, toLight) * 0.85 + 0.15, 0.0, 1.0) * lit * (0.12 + 0.88 * beam);
  // Hemispheric ambient: more from above than from the floor.
  float sky = 0.55 + 0.45 * bumped.y;
  // Grazing angles reveal the pile's shadowed depth: slightly darker.
  float pile = mix(0.8, 1.0, sqrt(max(dot(n, v), 0.0)));
  // Warm key light, slightly cool ambient (late-afternoon sun vs. bluish sky).
  vec3 sunColour = mix(vec3(1.0), vec3(1.0, 0.72, 0.44), beam);
  // Dim room: the beams carry most of the light.
  vec3 colour = base * (0.36 * sky * vec3(0.93, 0.95, 1.0) + sun * sunColour) * pile;
  outColor = vec4(pow(colour, vec3(1.0 / 2.2)), 1.0);
}`;

const floorVertex = /* glsl */ `#version 300 es
precision highp float;
in vec2 aUv;
uniform mat4 uViewProjection;
uniform vec4 uArea;
out vec3 vWorld;
void main() {
  vWorld = vec3(mix(uArea.x, uArea.z, aUv.x), 0.0, mix(uArea.y, uArea.w, aUv.y));
  gl_Position = uViewProjection * vec4(vWorld, 1.0);
}`;

const floorFragment = /* glsl */ `#version 300 es
precision highp float;
in vec3 vWorld;
uniform highp sampler2D uDepth;
uniform highp sampler2DShadow uShadow;
uniform mat4 uLight;
uniform float uDepthRange;
uniform float uTexel;
uniform float uStrength;
uniform float uDark;
// Light-space bounds of the rug, padded for the softest penumbra.
uniform vec4 uRugBox;
out vec4 outColor;
${disc}
${sunlight}

void main() {
  vec4 l = uLight * vec4(vWorld, 1.0);
  vec3 s = l.xyz / l.w * 0.5 + 0.5;
  // Blocker search in light space, only near the rug (most of the floor is clear).
  float found = 0.0;
  float depth = 0.0;
  if (all(greaterThan(s.xy, uRugBox.xy)) && all(lessThan(s.xy, uRugBox.zw))) {
    for (int i = 0; i < 16; i++) {
      float d = texture(uDepth, s.xy + DISC[i] * uTexel * 14.0).r;
      if (d < s.z - 0.0005) {
        found += 1.0;
        depth += d;
      }
    }
  }
  float shade = 0.0;
  float near = 0.0;
  float lit = 1.0;
  if (found > 0.5) {
    float height = (s.z - depth / found) * uDepthRange;
    // Area light: penumbra widens with blocker height (PCSS).
    float radius = uTexel * (1.5 + height * 260.0);
    lit = 0.0;
    for (int i = 0; i < 16; i++) lit += texture(uShadow, vec3(s.xy + DISC[i] * radius, s.z - 0.0005));
    lit /= 16.0;
    // Attenuate with distance.
    shade = (1.0 - lit) / (1.0 + height * 4.0);
    // Contact occlusion where the rug is close to the floor.
    near = found / 16.0 * 0.4 / (1.0 + height * 10.0);
  }
  // Sunlight patch on the floor, minus the rug's shadow.
  vec2 w = windowParts(vWorld);
  float beam = w.x * w.y * lit;
  // Dark theme: add the sun as warm light. Light theme: light can't be added to white, so tint
  // the beams warm instead, like low sun on a white wall. The shadow applies on top of either.
  float shadow = max(shade, near) * uStrength;
  float tint = uDark > 0.5 ? 0.0 : beam * 0.16;
  vec3 warm = uDark > 0.5 ? vec3(0.14, 0.09, 0.045) * beam : vec3(1.0, 0.84, 0.6) * tint;
  outColor = vec4(warm * (1.0 - shadow), max(shadow, tint));
}`;

type Matrix = Float32Array;

const multiply = (a: Matrix, b: Matrix): Matrix => {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
};

const perspective = (fov: number, aspect: number, near: number, far: number): Matrix => {
  const f = 1 / Math.tan(fov / 2);
  const range = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (near + far) * range, -1, 0, 0, 2 * near * far * range, 0]);
};

const orthographic = (half: number, near: number, far: number): Matrix => {
  const range = 1 / (near - far);
  return new Float32Array([1 / half, 0, 0, 0, 0, 1 / half, 0, 0, 0, 0, 2 * range, 0, 0, 0, (near + far) * range, 1]);
};

/** View matrix for a camera at `eye` looking at the origin. */
const lookAt = (eye: number[], up: number[]): Matrix => {
  const length = (v: number[]) => Math.hypot(v[0], v[1], v[2]);
  const back = eye.map((value) => value / length(eye));
  let right = [up[1] * back[2] - up[2] * back[1], up[2] * back[0] - up[0] * back[2], up[0] * back[1] - up[1] * back[0]];
  right = right.map((value) => value / length(right));
  const top = [back[1] * right[2] - back[2] * right[1], back[2] * right[0] - back[0] * right[2], back[0] * right[1] - back[1] * right[0]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return new Float32Array([
    right[0], top[0], back[0], 0,
    right[1], top[1], back[1], 0,
    right[2], top[2], back[2], 0,
    -dot(right, eye), -dot(top, eye), -dot(back, eye), 1,
  ]);
};

function compile(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const shader = (type: number, source: string) => {
    const made = gl.createShader(type)!;
    gl.shaderSource(made, source);
    gl.compileShader(made);
    if (!gl.getShaderParameter(made, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(made) ?? 'shader');
    return made;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, 'aUv');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'program');
  const locations = new Map<string, WebGLUniformLocation | null>();
  const at = (name: string) => {
    if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
    return locations.get(name)!;
  };
  return { program, at };
}

/** Triangulated grid over the unit square. */
function mesh(gl: WebGL2RenderingContext, across: number, along: number) {
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

/**
 * Initializes the rug in the stage's canvas. Resolves `false` when WebGL 2 is unavailable, leaving
 * the flat image in place.
 */
export async function mountRug(stage: HTMLElement): Promise<boolean> {
  const canvas = stage.querySelector<HTMLCanvasElement>('.rug__canvas');
  const gl = canvas?.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    // MSAA only on low-DPR screens; high-DPR screens don't need it.
    antialias: (window.devicePixelRatio || 1) < 1.5,
    powerPreference: 'low-power',
  });
  if (!canvas || !gl) return false;

  let rugProgram: ReturnType<typeof compile>;
  let depthProgram: ReturnType<typeof compile>;
  let floorProgram: ReturnType<typeof compile>;
  try {
    rugProgram = compile(gl, rugVertex, rugFragment);
    depthProgram = compile(gl, rugVertex, depthFragment);
    floorProgram = compile(gl, floorVertex, floorFragment);
  } catch {
    return false;
  }

  // Reuse the flat image's resolved source (chosen by Rug.astro's srcset) so the texture isn't
  // fetched twice, and decode it before upload.
  const picture = new Image();
  picture.src = stage.querySelector<HTMLImageElement>('.rug__flat img')?.currentSrc || rugPicture;
  try {
    await picture.decode();
  } catch {
    return false;
  }
  const woolTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, woolTexture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, picture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const anisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
  if (anisotropic) {
    gl.texParameterf(gl.TEXTURE_2D, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }

  // Cloth state as float textures, one texel per particle. Fewer substeps on low-end devices:
  // slightly softer cloth, ~20% less work.
  const cloth = new Cloth(COLUMNS, ROWS, modest() ? 8 : 10);
  const floatTexture = () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, COLUMNS, ROWS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return texture;
  };
  const positionTexture = floatTexture();
  const normalTexture = floatTexture();
  const upload = new Float32Array(cloth.count * 4);
  /** Previous simulation state, for interpolating between steps (see `loop`). */
  const before = { position: new Float32Array(cloth.position), normal: new Float32Array(cloth.normal) };
  const keepBefore = () => {
    before.position.set(cloth.position);
    before.normal.set(cloth.normal);
  };
  /** Uploads `values`, or a blend `t` of the way from `from` to `values`. */
  const send = (texture: WebGLTexture | null, values: Float32Array, from: Float32Array, t: number) => {
    for (let i = 0, j = 0; i < values.length; i += 3, j += 4) {
      upload[j] = from[i] + (values[i] - from[i]) * t;
      upload[j + 1] = from[i + 1] + (values[i + 1] - from[i + 1]) * t;
      upload[j + 2] = from[i + 2] + (values[i + 2] - from[i + 2]) * t;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, COLUMNS, ROWS, gl.RGBA, gl.FLOAT, upload);
  };

  // Shadow map with depth and comparison samplers. Rendered only while the rug moves, so the high
  // resolution is affordable.
  const SHADOW_SIZE = 1024;
  const shadowTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE);
  const shadowFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTexture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const compared = gl.createSampler()!;
  gl.samplerParameteri(compared, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.samplerParameteri(compared, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.samplerParameteri(compared, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.samplerParameteri(compared, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.samplerParameteri(compared, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.samplerParameteri(compared, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const raw = gl.createSampler()!;
  gl.samplerParameteri(raw, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.samplerParameteri(raw, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.samplerParameteri(raw, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.samplerParameteri(raw, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const rugMesh = mesh(gl, (COLUMNS - 1) * SUBDIVIDE, (ROWS - 1) * SUBDIVIDE);
  const quad = mesh(gl, 1, 1);

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toLight = [-0.5, 1.4, -0.7];
  const lightLength = Math.hypot(...toLight);
  const LIGHT_NEAR = 0.5;
  const LIGHT_FAR = 8;

  // Stage size in world units, and the camera above it.
  const view = { width: 1, height: 1, fov: 0.42, distance: 5, tan: Math.tan(0.21), aspect: 1 };
  let viewProjection: Matrix = new Float32Array(16);
  let lightViewProjection: Matrix = new Float32Array(16);
  let pixels = { width: 1, height: 1 };
  let shadowStrength = 0.3;
  let dark = true;
  let share = 0.62;
  let restAngle = -0.05;

  const layout = () => {
    const ratio = pixelRatio();
    pixels = { width: Math.max(1, Math.round(canvas.clientWidth * ratio)), height: Math.max(1, Math.round(canvas.clientHeight * ratio)) };
    if (canvas.width !== pixels.width || canvas.height !== pixels.height) {
      canvas.width = pixels.width;
      canvas.height = pixels.height;
    }
    view.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    share = cssNumber(stage, '--rug-share', 0.62);
    restAngle = cssNumber(stage, '--rug-angle', -0.05);
    view.width = 1 / share;
    view.height = view.width / view.aspect;
    view.tan = Math.tan(view.fov / 2);
    view.distance = view.height / 2 / view.tan;
    viewProjection = multiply(
      perspective(view.fov, view.aspect, 0.5, view.distance + 2),
      new Float32Array([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, -view.distance, 1]),
    );
    const eye = toLight.map((value) => (value / lightLength) * 4);
    const half = Math.max(view.width, view.height) * 0.62;
    lightViewProjection = multiply(orthographic(half, LIGHT_NEAR, LIGHT_FAR), lookAt(eye, [0, 0, -1]));
    const margin = 0.02;
    cloth.bounds = { left: -view.width / 2 + margin, right: view.width / 2 - margin, top: -view.height / 2 + margin, bottom: view.height / 2 - margin };
  };

  const readTheme = () => {
    dark = document.documentElement.dataset.theme === 'dark';
    shadowStrength = dark ? 0.75 : 0.42;
  };

  /** Shadow-map bounds around the rug, padded for the softest penumbra. */
  const rugBox = () => {
    const p = cloth.position;
    const low = [Infinity, Infinity, Infinity];
    const high = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < p.length; k += 3) {
      for (let d = 0; d < 3; d++) {
        low[d] = Math.min(low[d], p[k + d]);
        high[d] = Math.max(high[d], p[k + d]);
      }
    }
    const m = lightViewProjection;
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (let corner = 0; corner < 8; corner++) {
      const x = corner & 1 ? high[0] : low[0];
      const y = corner & 2 ? high[1] : low[1];
      const z = corner & 4 ? high[2] : low[2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * 0.5 + 0.5;
      const sy = ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * 0.5 + 0.5;
      box[0] = Math.min(box[0], sx);
      box[1] = Math.min(box[1], sy);
      box[2] = Math.max(box[2], sx);
      box[3] = Math.max(box[3], sy);
    }
    const margin = 64 / SHADOW_SIZE;
    return [box[0] - margin, box[1] - margin, box[2] + margin, box[3] + margin];
  };

  /** Renders the rug at its current state, or `t` of the way from the previous step. */
  const draw = (t = 1) => {
    send(positionTexture, cloth.position, before.position, t);
    send(normalTexture, cloth.normal, before.normal, t);

    const bindCloth = (program: ReturnType<typeof compile>) => {
      gl.uniform1i(program.at('uPositions'), 0);
      gl.uniform1i(program.at('uNormals'), 1);
      gl.uniform2i(program.at('uGrid'), COLUMNS, ROWS);
    };
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, positionTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);

    // Shadow-map pass.
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 2);
    gl.useProgram(depthProgram.program);
    bindCloth(depthProgram);
    gl.uniformMatrix4fv(depthProgram.at('uViewProjection'), false, lightViewProjection);
    gl.bindVertexArray(rugMesh.vao);
    gl.drawElements(gl.TRIANGLES, rugMesh.count, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // Floor and cast-shadow pass.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, pixels.width, pixels.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
    gl.bindSampler(2, raw);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
    gl.bindSampler(3, compared);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(floorProgram.program);
    gl.uniformMatrix4fv(floorProgram.at('uViewProjection'), false, viewProjection);
    gl.uniformMatrix4fv(floorProgram.at('uLight'), false, lightViewProjection);
    gl.uniform4f(floorProgram.at('uArea'), -view.width / 2, -view.height / 2, view.width / 2, view.height / 2);
    gl.uniform1i(floorProgram.at('uDepth'), 2);
    gl.uniform1i(floorProgram.at('uShadow'), 3);
    gl.uniform1f(floorProgram.at('uDepthRange'), LIGHT_FAR - LIGHT_NEAR);
    gl.uniform1f(floorProgram.at('uTexel'), 1 / SHADOW_SIZE);
    gl.uniform1f(floorProgram.at('uStrength'), shadowStrength);
    gl.uniform1f(floorProgram.at('uDark'), dark ? 1 : 0);
    gl.uniform3f(floorProgram.at('uToLight'), toLight[0], toLight[1], toLight[2]);
    const box = rugBox();
    gl.uniform4f(floorProgram.at('uRugBox'), box[0], box[1], box[2], box[3]);
    gl.bindVertexArray(quad.vao);
    gl.drawElements(gl.TRIANGLES, quad.count, gl.UNSIGNED_SHORT, 0);

    // Rug pass.
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(rugProgram.program);
    bindCloth(rugProgram);
    gl.uniformMatrix4fv(rugProgram.at('uViewProjection'), false, viewProjection);
    gl.uniformMatrix4fv(rugProgram.at('uLight'), false, lightViewProjection);
    gl.uniform3f(rugProgram.at('uToLight'), toLight[0], toLight[1], toLight[2]);
    gl.uniform3f(rugProgram.at('uEye'), 0, view.distance, 0);
    gl.uniform2f(rugProgram.at('uCells'), CELLS_ACROSS, CELLS_ALONG);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, woolTexture);
    gl.uniform1i(rugProgram.at('uWeave'), 4);
    gl.uniform1i(rugProgram.at('uShadow'), 3);
    gl.bindVertexArray(rugMesh.vao);
    gl.drawElements(gl.TRIANGLES, rugMesh.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  };

  // --- Pointer ---

  /** Intersection of a screen point's ray with the plane `height` above the floor. */
  const onPlane = (clientX: number, clientY: number, height: number) => {
    const box = canvas.getBoundingClientRect();
    const nx = ((clientX - box.left) / box.width) * 2 - 1;
    const ny = 1 - ((clientY - box.top) / box.height) * 2;
    const t = view.distance - height;
    return [nx * view.tan * view.aspect * t, height, -ny * view.tan * t];
  };

  /**
   * Topmost particle under a screen point. Hits within `near` px of the edge count, since a
   * fingertip is wider than a cursor.
   */
  const particleAt = (clientX: number, clientY: number, near = 14) => {
    const box = canvas.getBoundingClientRect();
    const reach = Math.max(near, (box.width * share) / (COLUMNS - 1)) ** 2;
    let best = -1;
    let bestHeight = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < cloth.count; i++) {
      const x = cloth.position[i * 3];
      const y = cloth.position[i * 3 + 1];
      const z = cloth.position[i * 3 + 2];
      const depth = (view.distance - y) * view.tan;
      const sx = box.left + ((x / (depth * view.aspect) + 1) / 2) * box.width;
      const sy = box.top + ((1 + z / depth) / 2) * box.height;
      const distance = (sx - clientX) ** 2 + (sy - clientY) ** 2;
      if (distance > reach) continue;
      if (y > bestHeight + 0.004 || (Math.abs(y - bestHeight) <= 0.004 && distance < bestDistance)) {
        best = i;
        bestHeight = y;
        bestDistance = distance;
      }
    }
    return best;
  };

  // --- Motion ---

  let frame = 0;
  let last = 0;
  let behind = 0;
  /** Seconds without visible motion. */
  let quiet = 0;
  /** Seconds since the last release. */
  let idle = 0;
  /** Interactive once the corner curl has settled. */
  let ready = false;
  let disturbed = false;
  const hold = { pointer: -1, offset: [0, 0], lifted: 0, from: 0, trail: [] as { t: number; p: number[] }[] };

  /**
   * Rest-pose curl: the corner nearest the viewer (bottom right on screen) is slightly lifted and
   * rises toward an approaching pointer, hinting at the message underneath (Rug.astro).
   */
  const curl = { on: false, corner: -1, flat: [0, 0, 0], inward: [0, 0], level: 0, goal: 0 };
  /**
   * Scripted move for the "Lift the rug" button: the corner follows a path, then is released, or
   * held at the end with `keep`.
   */
  let script: {
    from: number[];
    to: number[];
    peak: number;
    t: number;
    duration: number;
    keep?: boolean;
    done: () => void;
  } | null = null;
  let lifted = false;

  const setState = (state: 'moving' | 'resting') => {
    if (stage.dataset.state !== state) stage.dataset.state = state;
  };

  /** Finds the corner nearest the viewer and its flat position. */
  const findCorner = () => {
    const corners = [0, COLUMNS - 1, (ROWS - 1) * COLUMNS, ROWS * COLUMNS - 1];
    let best = corners[0];
    for (const i of corners) {
      if (cloth.position[i * 3] + cloth.position[i * 3 + 2] > cloth.position[best * 3] + cloth.position[best * 3 + 2]) best = i;
    }
    curl.corner = best;
    curl.flat = Array.from(cloth.position.subarray(best * 3, best * 3 + 3));
    // Lean the curl inward so the corner folds like a dog-ear and shows a little of its back.
    const length = Math.hypot(curl.flat[0], curl.flat[2]) || 1;
    curl.inward = [(-curl.flat[0] / length) * 0.16, (-curl.flat[2] / length) * 0.16];
  };

  const curlTo = (level: number) => {
    const e = level / CURL_NEAR;
    cloth.target[0] = curl.flat[0] + curl.inward[0] * e;
    cloth.target[1] = curl.flat[1] + level;
    cloth.target[2] = curl.flat[2] + curl.inward[1] * e;
  };

  /** Curls the corner up to `goal`. */
  const curlUp = (goal = CURL) => {
    if (!ready || still.matches || hold.pointer >= 0 || script || lifted) return;
    if (!curl.on) {
      findCorner();
      cloth.hold(curl.corner);
      curl.on = true;
      curl.level = 0;
    }
    curl.goal = goal;
    wake();
  };

  /** Releases the corner curl before the rug is grabbed or a scripted move starts. */
  const uncurl = () => {
    if (!curl.on) return;
    curl.on = false;
    cloth.hold(null);
  };

  /** Advances the simulation one step, along with whatever drives it: pointer, script or curl. */
  const advance = () => {
    if (hold.pointer >= 0) {
      // Ease the held point up to lift height.
      hold.lifted = Math.min(1, hold.lifted + STEP / 0.15);
      const eased = 1 - (1 - hold.lifted) ** 3;
      cloth.target[1] = hold.from + (LIFT - hold.from) * eased;
    } else if (script) {
      // Scripted path: eased, and raised in an arc along the way.
      script.t = Math.min(1, script.t + STEP / script.duration);
      const e = script.t < 0.5 ? 4 * script.t ** 3 : 1 - (-2 * script.t + 2) ** 3 / 2;
      for (let d = 0; d < 3; d++) cloth.target[d] = script.from[d] + (script.to[d] - script.from[d]) * e;
      cloth.target[1] += script.peak * Math.sin(Math.PI * e);
      if (script.t >= 1) {
        const { done, keep } = script;
        script = null;
        if (!keep) cloth.release(0, 0, 0, STEP);
        done();
      }
    } else if (curl.on) {
      // Ease the curl toward its goal slowly, like heavy fabric.
      curl.level += (curl.goal - curl.level) * 0.04;
      curlTo(curl.level);
    }
    keepBefore();
    cloth.step(STEP);
  };

  const loop = (time: number) => {
    frame = 0;
    if (document.hidden) return;
    // Restarting: no previous state to interpolate from.
    if (!last) keepBefore();
    const dt = Math.min((time - (last || time)) / 1000, 0.05);
    // Real elapsed time, capped. On slow devices the simulation falls behind, but rest detection
    // still runs in wall-clock seconds.
    const passed = Math.min((time - (last || time)) / 1000, 0.5);
    last = time;
    behind += dt;
    let steps = 0;
    while (behind >= STEP && steps < 2) {
      advance();
      behind -= STEP;
      steps++;
    }
    idle = hold.pointer < 0 && !script ? idle + passed : 0;
    if (steps === 2) behind = 0;
    // Fixed 60 Hz steps, rendered interpolated by the fraction into the next step, so motion is
    // even at any refresh rate (90/120 Hz).
    draw(behind / STEP);
    // Rest detection: nothing moved more than ~0.5 px per frame for 1/3 s, or, 5 s after release,
    // nothing is visibly moving. Doubled-over layers can keep a sub-pixel tremor that isn't worth a
    // running loop, and a settled curl only sags by sub-pixel amounts, which also counts as rest.
    const easing = curl.on && Math.abs(curl.goal - curl.level) > 0.0005;
    const settled = curl.on ? 0.004 : 0.0015;
    // Accumulated in seconds, not frames, so slow devices behave the same.
    quiet = hold.pointer < 0 && !script && !easing && cloth.motion < settled ? quiet + passed : 0;
    if (quiet > 0.33 || (idle > 2.5 && cloth.motion < 0.006)) {
      last = 0;
      behind = 0;
      // At rest: draw the final state.
      draw();
      setState('resting');
      return;
    }
    frame = requestAnimationFrame(loop);
  };

  const wake = () => {
    if (still.matches) return;
    setState('moving');
    quiet = 0;
    if (!frame) frame = requestAnimationFrame(loop);
  };

  /**
   * Rest pose, with the corner curled (flat under reduced motion). Computed once, off-screen, in
   * time slices of a few ms so the main thread never blocks; afterwards the cached pose is restored
   * instantly.
   */
  let laid: { angle: number; cloth: ReturnType<Cloth['snapshot']>; corner: number; flat: number[]; inward: number[] } | null = null;
  const rest = async () => {
    uncurl();
    script = null;
    cloth.hold(null);
    disturbed = false;
    setLifted(false);
    if (laid && laid.angle === restAngle) {
      cloth.restore(laid.cloth);
      curl.corner = laid.corner;
      curl.flat = laid.flat;
      curl.inward = laid.inward;
    } else {
      cloth.layFlat(0, 0, restAngle);
      if (still.matches) return;
      findCorner();
    }
    cloth.hold(curl.corner);
    curl.on = true;
    curl.level = curl.goal = CURL;
    curlTo(CURL);
    if (laid && laid.angle === restAngle) return;
    let slice = performance.now();
    for (let n = 0; n < 120; n++) {
      cloth.step(STEP);
      if (performance.now() - slice > 8) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        slice = performance.now();
      }
    }
    laid = { angle: restAngle, cloth: cloth.snapshot(), corner: curl.corner, flat: [...curl.flat], inward: [...curl.inward] };
  };

  const setLifted = (value: boolean) => {
    lifted = value;
    stage.toggleAttribute('data-lifted', value);
    stage.dispatchEvent(new CustomEvent('rug:lifted', { detail: value, bubbles: true }));
  };

  /**
   * "Lift the rug" button: folds the corner over toward the middle to reveal the message; pressing
   * again folds it back.
   */
  /** Reduced motion: the fold is being simulated off-screen. */
  let folding = false;
  const toggleLift = () => {
    if (!ready || hold.pointer >= 0 || script) return;
    if (still.matches) {
      // Reduced motion: reset instantly, or simulate the fold off-screen in time slices and show
      // the settled result.
      if (folding) return;
      if (lifted) {
        void rest().then(() => draw());
        return;
      }
      folding = true;
      findCorner();
      cloth.hold(curl.corner);
      const from = Array.from(cloth.position.subarray(curl.corner * 3, curl.corner * 3 + 3));
      script = { from, to: [from[0] * -0.22, 0.025, from[2] * -0.22], peak: 0.24, t: 0, duration: 1.35, keep: true, done: () => undefined };
      disturbed = true;
      setLifted(true);
      void (async () => {
        // The move, then 1.5 s for the cloth to settle.
        let settle = 90;
        let slice = performance.now();
        for (let n = 0; n < 400 && (script || settle-- > 0); n++) {
          advance();
          if (performance.now() - slice > 8) {
            await new Promise((resolve) => setTimeout(resolve, 0));
            slice = performance.now();
          }
        }
        folding = false;
        draw();
      })();
      return;
    }
    if (!lifted) {
      uncurl();
      findCorner();
      cloth.hold(curl.corner);
      const from = Array.from(cloth.position.subarray(curl.corner * 3, curl.corner * 3 + 3));
      // Just past the middle, raised by one fold's thickness, and held; the cloth's stiffness would
      // otherwise flip it back.
      const to = [from[0] * -0.22, 0.025, from[2] * -0.22];
      script = { from, to, peak: 0.24, t: 0, duration: 1.35, keep: true, done: () => undefined };
      disturbed = true;
      setLifted(true);
    } else {
      // Back: carry the folded corner home and set it down.
      const corner = curl.corner;
      cloth.hold(corner);
      const from = Array.from(cloth.position.subarray(corner * 3, corner * 3 + 3));
      script = {
        from,
        to: [curl.flat[0], curl.flat[1], curl.flat[2]],
        peak: 0.16,
        t: 0,
        duration: 1.05,
        done: () => {
          setLifted(false);
          window.setTimeout(() => curlUp(), 700);
        },
      };
    }
    wake();
  };
  stage.addEventListener('rug:toggle', toggleLift);

  // Grab and release.
  const lead = (event: PointerEvent) => {
    const p = onPlane(event.clientX, event.clientY, cloth.target[1]);
    const x = clamp(p[0] + hold.offset[0], cloth.bounds.left, cloth.bounds.right);
    const z = clamp(p[2] + hold.offset[1], cloth.bounds.top, cloth.bounds.bottom);
    cloth.target[0] = x;
    cloth.target[2] = z;
    const now = performance.now();
    hold.trail.push({ t: now, p: [x, cloth.target[1], z] });
    while (hold.trail.length > 2 && now - hold.trail[0].t > 80) hold.trail.shift();
  };

  const pickUp = (pointerId: number, clientX: number, clientY: number, particle: number) => {
    if (particle < 0 || script) return;
    uncurl();
    // Grabbing cancels a held fold.
    if (lifted) setLifted(false);
    idle = 0;
    cloth.hold(particle);
    hold.pointer = pointerId;
    hold.lifted = 0;
    hold.from = cloth.position[particle * 3 + 1];
    hold.trail = [];
    const p = onPlane(clientX, clientY, hold.from);
    hold.offset = [cloth.position[particle * 3] - p[0], cloth.position[particle * 3 + 2] - p[2]];
    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      // The pointer may already be released.
    }
    stage.setAttribute('data-holding', '');
    // Grabbing counts as opening the rug; plane.ts launches the plane.
    stage.setAttribute('data-looked', '');
    disturbed = true;
    wake();
  };

  const letGo = () => {
    if (hold.pointer < 0) return;
    const trail = hold.trail;
    let velocity = [0, 0, 0];
    if (trail.length >= 2) {
      const first = trail[0];
      const end = trail[trail.length - 1];
      const seconds = Math.max((end.t - first.t) / 1000, 1 / 120);
      // Cap the release velocity: a rug is heavy.
      velocity = end.p.map((value, i) => clamp((value - first.p[i]) / seconds, -1.5, 1.5));
    }
    cloth.release(velocity[0], 0, velocity[2], STEP);
    hold.pointer = -1;
    stage.removeAttribute('data-holding');
    wake();
  };

  /**
   * Touch disambiguation, since a finger on the rug may be a scroll: a stationary press grabs after
   * HOLD ms; a horizontal start grabs immediately (the page never scrolls horizontally); a vertical
   * start is left to the browser. A tap lifts the corner, like the button.
   */
  const HOLD = 260;
  /** Max finger travel, in px, that still counts as a stationary press. */
  const SLOP = 8;
  /** Touch hit slop around the rug's edge, in px. */
  const FINGER = 24;
  /** Pending touch press: where it started and where the finger is now. */
  let press: { id: number; x: number; y: number; nowX: number; nowY: number; timer: number } | null = null;
  let tapped = false;
  /**
   * Active touch points. Two or more is a pinch-zoom, which belongs to the browser; otherwise a
   * horizontal pinch would read as a horizontal drag and block the zoom.
   */
  const fingers = new Set<number>();
  const unpress = () => {
    if (press) window.clearTimeout(press.timer);
    press = null;
  };
  canvas.addEventListener('pointerdown', (event) => {
    tapped = false;
    const touch = event.pointerType === 'touch';
    if (touch) {
      // A new primary pointer starts a new gesture.
      if (event.isPrimary) fingers.clear();
      fingers.add(event.pointerId);
      if (fingers.size > 1) {
        unpress();
        return;
      }
    }
    if (!ready || hold.pointer >= 0 || event.button > 0) return;
    // Reduced motion: no dragging, but a tap still lifts the corner.
    if (still.matches && !touch) return;
    const particle = particleAt(event.clientX, event.clientY, touch ? FINGER : 14);
    if (particle < 0) return;
    if (touch) {
      unpress();
      const { pointerId, clientX: x, clientY: y } = event;
      press = {
        id: pointerId,
        x,
        y,
        nowX: x,
        nowY: y,
        timer: window.setTimeout(() => {
          if (!press || still.matches || fingers.size > 1) return;
          const { nowX, nowY } = press;
          press = null;
          pickUp(pointerId, nowX, nowY, particleAt(nowX, nowY, FINGER));
        }, HOLD),
      };
      return;
    }
    event.preventDefault();
    pickUp(event.pointerId, event.clientX, event.clientY, particle);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (press && event.pointerId === press.id) {
      press.nowX = event.clientX;
      press.nowY = event.clientY;
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (Math.hypot(dx, dy) > SLOP) {
        const { x, y } = press;
        unpress();
        // Horizontal start: grab at the touch-down point and follow the finger.
        if (Math.abs(dx) > Math.abs(dy) && !still.matches && fingers.size === 1) {
          pickUp(event.pointerId, x, y, particleAt(x, y, FINGER));
        }
      }
    }
    if (event.pointerId === hold.pointer) {
      lead(event);
      wake();
    } else if (event.pointerType !== 'touch' && ready && !still.matches) {
      stage.toggleAttribute('data-over', particleAt(event.clientX, event.clientY) >= 0);
      // Pointer near the curled corner: raise it to meet the cursor.
      if (curl.on) {
        const box = canvas.getBoundingClientRect();
        const i = curl.corner * 3;
        const depth = (view.distance - cloth.position[i + 1]) * view.tan;
        const sx = box.left + ((cloth.position[i] / (depth * view.aspect) + 1) / 2) * box.width;
        const sy = box.top + ((1 + cloth.position[i + 2] / depth) / 2) * box.height;
        const near = Math.hypot(sx - event.clientX, sy - event.clientY) < box.width * 0.12;
        const goal = near ? CURL_NEAR : CURL;
        if (goal !== curl.goal) curlUp(goal);
      }
    }
  });
  const end = (event: PointerEvent) => {
    // Released before the hold timer without moving: a tap. Only a real tap is followed by a click;
    // a tap that merely stopped a fling isn't.
    if (press && event.pointerId === press.id) tapped = event.type === 'pointerup';
    fingers.delete(event.pointerId);
    unpress();
    if (event.pointerId === hold.pointer) letGo();
  };
  canvas.addEventListener('click', () => {
    if (!tapped) return;
    tapped = false;
    // Marks the rug as opened; plane.ts launches the plane.
    if (!lifted) stage.setAttribute('data-looked', '');
    toggleLift();
  });
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  canvas.addEventListener('pointerleave', () => {
    stage.removeAttribute('data-over');
    if (curl.on && curl.goal !== CURL) curlUp(CURL);
  });
  // Block page scrolling while the rug is held on touch.
  canvas.addEventListener(
    'touchmove',
    (event) => {
      if (hold.pointer >= 0) event.preventDefault();
    },
    { passive: false },
  );
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // --- Lifecycle ---

  // After interaction, reset the pose for next time. Resetting costs a heavy frame, so never
  // mid-scroll or during the plane's 1.5 s landing: wait until the page is idle, or at the latest
  // until the rug approaches the viewport again (`coming`, which also covers jumps). Scrolling away
  // and straight back keeps the current pose; it is never reset while in view.
  let relay = false;
  let relayTimer = 0;
  let inSight = true;
  const relayNow = (coming = false) => {
    window.clearTimeout(relayTimer);
    if (!relay) return;
    relay = false;
    if ((coming || !inSight) && ready && disturbed && hold.pointer < 0 && !script) void rest().then(() => draw());
  };
  const relayLater = () => {
    window.clearTimeout(relayTimer);
    relayTimer = window.setTimeout(() => relayNow(), 1600);
  };
  window.addEventListener(
    'scroll',
    () => {
      if (relay) relayLater();
    },
    { passive: true },
  );
  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) relayNow(true);
    },
    { rootMargin: '50% 0px' },
  ).observe(stage);

  new IntersectionObserver(
    ([entry]) => {
      inSight = entry.isIntersecting;
      if (inSight) return;
      // Off-screen: stop the loop immediately.
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
        behind = 0;
        setState('resting');
      }
      if (ready && disturbed && hold.pointer < 0 && !script) {
        relay = true;
        relayLater();
      }
    },
    { threshold: [0, 0.35] },
  ).observe(stage);

  new ResizeObserver(() => {
    layout();
    draw();
  }).observe(canvas);
  new MutationObserver(() => {
    readTheme();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && stage.dataset.state === 'moving') wake();
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stage.removeAttribute('data-live');
  });

  // Apply the rest pose, then swap it in for the flat image. If the flat image was lifted
  // (index.ts) before the scene was ready, apply the lift so the click isn't lost.
  const liftWanted = stage.hasAttribute('data-lifted');
  readTheme();
  layout();
  await rest();
  ready = true;
  draw();
  setState('resting');
  stage.setAttribute('data-live', '');
  if (liftWanted) toggleLift();
  return true;
}

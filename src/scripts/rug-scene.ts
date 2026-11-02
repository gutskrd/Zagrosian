/**
 * The rug (Rug.astro) as a rug of wool lying on the page, seen from above,
 * that can be picked up: lift a corner and fold it over, drag it, twist it
 * round, let go and it drops and settles, as cloth does. WebGL 2.
 *
 * - The cloth is rug-cloth.ts: a grid of particles. Each frame its positions
 *   and normals go to the GPU as two small float textures, and a finer mesh
 *   (four times as many rows and columns) is drawn through them with
 *   Catmull-Rom curves, so folds are round, not faceted.
 * - The wool is the rug's picture (scripts/rug.mjs), as a mipmapped texture;
 *   the shader adds the pile, a shade to each knot, and the light on each pip.
 * - The light is a large soft one from the upper left. Its shadow map (the
 *   rug's depth as the light sees it) gives the shadow the rug casts on the
 *   page, sharp where it touches and softer the higher it is lifted
 *   (percentage-closer soft shadows), and the shadow a fold casts on the rug
 *   under it.
 * - It is made in front of you: it lies at first as bare warp threads, and
 *   when it comes into view the weft is woven in from the bottom up, a row at
 *   a time, the newest row catching the light; then it is cloth.
 * - Hover shows a hand; press and drag (on a touch screen, press and hold
 *   first, so scrolling stays scrolling).
 *
 * It simulates and draws only while something moves; at rest it costs
 * nothing. Played with and scrolled away, it is laid straight again. For
 * visitors who prefer reduced motion it lies still and flat.
 */
import rugPicture from '../assets/rug/rug.webp?url';
import { pixelRatio } from './device';
import { Cloth } from './rug-cloth';

/**
 * The rug's picture in cells of two knots by two (scripts/rug.mjs): across,
 * along the weave, and the fringe at each end.
 */
const CELLS_ACROSS = 101;
const WEAVE_ROWS = 161;
const FRINGE = 6;
const COLUMNS = 29;
const CELLS_ALONG = WEAVE_ROWS + 2 * FRINGE;
const ROWS = Math.round((COLUMNS - 1) * (CELLS_ALONG / CELLS_ACROSS)) + 1;
const SUBDIVIDE = 4;
/**
 * How much of the stage's width the rug takes, and how it lies at rest, are
 * set in CSS (`--rug-share`, `--rug-angle` on the stage in Rug.astro), so the
 * flat picture, the message under the rug and this scene always agree.
 */
const cssNumber = (element: HTMLElement, name: string, fallback: number) => {
  const value = parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
};
const LIFT = 0.1;
/** How high the corner that invites a hand rests, and how high it rises when one comes near. */
const CURL = 0.065;
const CURL_NEAR = 0.11;
const STEP = 1 / 60;
/** How long the weaving takes, in seconds. */
const WEAVING = 2.6;

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

// The cloth at a point between its particles, through the four by four
// nearest of them.
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

/** Where the weaving has reached: rows above it (towards the top) are still bare warp. */
const loom = /* glsl */ `
uniform float uWoven;
uniform float uEnds;
bool bare(vec2 uv) {
  float line = 1.0 - uEnds - uWoven * (1.0 - 2.0 * uEnds);
  return uv.y > uEnds && uv.y < line;
}
`;

// Only what is woven casts a shadow.
const depthFragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
${loom}
void main() {
  if (bare(vUv)) discard;
}`;

/**
 * Dim late sun through a window, as in the photographs of Hevalo's kilims:
 * two broad beams of warm light across the floor and the rug, one after the
 * other as the window's panes let them through, the soft shadow of the bar
 * between them,
 * their edges as soft as a low sun makes them, and the whole patch brightest
 * nearest the window and fading as the light spreads. A point above the floor
 * (a lifted corner) is lit where its light crossed the window, so it is
 * traced back along the light to the floor and the beams bend over the cloth
 * as they would in a room.
 */
const sunlight = /* glsl */ `
uniform vec3 uToLight;
float speck(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// Soft noise, for the mottle of the wool (rugFragment).
float mottle(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(speck(i), speck(i + vec2(1.0, 0.0)), f.x), mix(speck(i + vec2(0.0, 1.0)), speck(i + vec2(1.0, 1.0)), f.x), f.y);
}
// x: how much of the window's patch of light this point is in; y: how much
// of the beams' light reaches it there.
vec2 windowParts(vec3 p) {
  vec2 q = p.xz - uToLight.xz / uToLight.y * p.y;
  // Along the light (the beams are stretched that way) and across it.
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

/** Sixteen points spread evenly over a disc, for soft shadows. */
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
${loom}
${sunlight}

void main() {
  // Not woven yet: only the warp, a thread to a cell, stretched straight.
  if (bare(vUv)) {
    float k = vUv.x * uCells.x;
    float edge = fwidth(k);
    float cover = 1.0 - smoothstep(0.17 - edge, 0.17 + edge, abs(fract(k) - 0.5));
    if (cover < 0.04) discard;
    outColor = vec4(vec3(0.6, 0.58, 0.54) * cover, cover);
    return;
  }
  vec4 wool = texture(uWeave, vUv);
  if (wool.a < 0.45) discard;
  vec3 base = pow(wool.rgb / wool.a, vec3(2.2));
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) {
    n = -n;
    // The back of a pile rug: the same pattern, flatter and duller.
    base *= 0.78;
  }

  // The pips of wool catch the light: two passes a cell over two warps, as in
  // the texture. They fade where they are too small to see.
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
  // The pile: each knot a little lighter or darker than its neighbours, as
  // wool is, fading out where knots are too small to see; and a fine mottle
  // over it, a cell or so across, as tufts lie this way and that.
  float tuft = fract(sin(dot(floor(cell * 2.0), vec2(12.9898, 78.233))) * 43758.5453);
  base *= mix(1.0, 0.88 + 0.2 * tuft, detail);
  float fine = 1.0 - smoothstep(0.7, 1.6, max(fwidth(cell.x), fwidth(cell.y)));
  base *= mix(1.0, 0.93 + 0.14 * mottle(cell * 0.85), fine);

  // How much of the light reaches it, past any fold above.
  vec4 l = uLight * vec4(vWorld + n * 0.006, 1.0);
  vec3 s = l.xyz / l.w * 0.5 + 0.5;
  float lit = 0.0;
  for (int i = 0; i < 8; i++) lit += texture(uShadow, vec3(s.xy + DISC[i * 2] * 0.0035, s.z - 0.0015));
  lit /= 8.0;

  vec3 toLight = normalize(uToLight);
  vec3 v = normalize(uEye - vWorld);
  // The sun reaches it only through the window, in its beams.
  float beam = window(vWorld);
  // Wool is matte and fuzzy: light wraps a little way round its folds
  // instead of stopping at a hard edge, and nothing on it shines.
  float sun = clamp(dot(bumped, toLight) * 0.85 + 0.15, 0.0, 1.0) * lit * (0.12 + 0.88 * beam);
  // Light from the whole room, less from the floor.
  float sky = 0.55 + 0.45 * bumped.y;
  // Pile seen side-on, down a fold, shows its shadowed depths: a little darker.
  float pile = mix(0.8, 1.0, sqrt(max(dot(n, v), 0.0)));
  // Late sun is warm, so the wool it falls on glows amber; the room's light,
  // from a sky already going blue, is a little cool.
  vec3 sunColour = mix(vec3(1.0), vec3(1.0, 0.72, 0.44), beam);
  // The room itself is dim: the beams are where the rug glows.
  vec3 colour = base * (0.36 * sky * vec3(0.93, 0.95, 1.0) + sun * sunColour) * pile;
  // The row just woven, still catching the light as it is beaten down.
  if (uWoven < 1.0) {
    float line = 1.0 - uEnds - uWoven * (1.0 - 2.0 * uEnds);
    float fresh = 1.0 - smoothstep(0.0, 2.5 / uCells.y, vUv.y - line);
    colour = mix(colour, colour * 1.25 + 0.04, fresh * step(line, vUv.y));
  }
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
out vec4 outColor;
${disc}
${sunlight}

void main() {
  vec4 l = uLight * vec4(vWorld, 1.0);
  vec3 s = l.xyz / l.w * 0.5 + 0.5;
  // Where the rug is, as the light sees it, and how high above the floor.
  float found = 0.0;
  float depth = 0.0;
  for (int i = 0; i < 16; i++) {
    float d = texture(uDepth, s.xy + DISC[i] * uTexel * 14.0).r;
    if (d < s.z - 0.0005) {
      found += 1.0;
      depth += d;
    }
  }
  float shade = 0.0;
  float near = 0.0;
  float lit = 1.0;
  if (found > 0.5) {
    float height = (s.z - depth / found) * uDepthRange;
    // A large light: the higher the rug, the softer its shadow.
    float radius = uTexel * (1.5 + height * 260.0);
    lit = 0.0;
    for (int i = 0; i < 16; i++) lit += texture(uShadow, vec3(s.xy + DISC[i] * radius, s.z - 0.0005));
    lit /= 16.0;
    // Fainter the further it falls.
    shade = (1.0 - lit) / (1.0 + height * 4.0);
    // And a soft dimness all round where it lies close: the room's light is hidden.
    near = found / 16.0 * 0.4 / (1.0 + height * 10.0);
  }
  // The patch of sun on the floor, where the rug does not stand in its way.
  vec2 w = windowParts(vWorld);
  float beam = w.x * w.y * lit;
  // On a dark page the sun is added as warm light. On a light one, where
  // light cannot be added to white, the beams tint the page warm instead,
  // as low sun does a white wall. The rug's shadow lies over either.
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

/** A camera at `eye` looking at the origin, with `up` towards the top of its picture. */
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

/** A grid of points over the unit square, as triangles. */
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Sets the rug up in the stage's canvas. Resolves false where WebGL 2 is not
 * available, and the flat picture stays.
 */
export async function mountRug(stage: HTMLElement): Promise<boolean> {
  const canvas = stage.querySelector<HTMLCanvasElement>('canvas');
  const gl = canvas?.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    // Smoothed edges where pixels are large; denser screens do not need it.
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

  // The wool: the rug's picture (scripts/rug.mjs), decoded before it is needed.
  const picture = new Image();
  picture.src = rugPicture;
  try {
    await picture.decode();
  } catch {
    return false;
  }
  const weaveTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, weaveTexture);
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

  // The cloth's positions and normals, a texel a particle.
  const cloth = new Cloth(COLUMNS, ROWS);
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
  const send = (texture: WebGLTexture | null, values: Float32Array) => {
    for (let i = 0; i < cloth.count; i++) upload.set(values.subarray(i * 3, i * 3 + 3), i * 4);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, COLUMNS, ROWS, gl.RGBA, gl.FLOAT, upload);
  };

  // The shadow map, and two ways of reading it: as depths, and compared. It
  // is drawn only while the rug moves, so it stays this fine everywhere.
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

  // The stage in world units, and the camera above it.
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

  const draw = () => {
    send(positionTexture, cloth.position);
    send(normalTexture, cloth.normal);

    // How far the weaving has got, a whole row at a time.
    const bindLoom = (program: ReturnType<typeof compile>) => {
      gl.uniform1f(program.at('uWoven'), Math.floor(woven * WEAVE_ROWS) / WEAVE_ROWS);
      gl.uniform1f(program.at('uEnds'), FRINGE / CELLS_ALONG);
    };
    const bindCloth = (program: ReturnType<typeof compile>) => {
      gl.uniform1i(program.at('uPositions'), 0);
      gl.uniform1i(program.at('uNormals'), 1);
      gl.uniform2i(program.at('uGrid'), COLUMNS, ROWS);
    };
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, positionTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);

    // The rug as the light sees it.
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 2);
    gl.useProgram(depthProgram.program);
    bindCloth(depthProgram);
    bindLoom(depthProgram);
    gl.uniformMatrix4fv(depthProgram.at('uViewProjection'), false, lightViewProjection);
    gl.bindVertexArray(rugMesh.vao);
    gl.drawElements(gl.TRIANGLES, rugMesh.count, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // The shadow on the page.
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
    gl.bindVertexArray(quad.vao);
    gl.drawElements(gl.TRIANGLES, quad.count, gl.UNSIGNED_SHORT, 0);

    // The rug.
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(rugProgram.program);
    bindCloth(rugProgram);
    bindLoom(rugProgram);
    gl.uniformMatrix4fv(rugProgram.at('uViewProjection'), false, viewProjection);
    gl.uniformMatrix4fv(rugProgram.at('uLight'), false, lightViewProjection);
    gl.uniform3f(rugProgram.at('uToLight'), toLight[0], toLight[1], toLight[2]);
    gl.uniform3f(rugProgram.at('uEye'), 0, view.distance, 0);
    gl.uniform2f(rugProgram.at('uCells'), CELLS_ACROSS, CELLS_ALONG);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, weaveTexture);
    gl.uniform1i(rugProgram.at('uWeave'), 4);
    gl.uniform1i(rugProgram.at('uShadow'), 3);
    gl.bindVertexArray(rugMesh.vao);
    gl.drawElements(gl.TRIANGLES, rugMesh.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  };

  // --- Pointer -----------------------------------------------------------

  /** Where a point on the screen meets the plane `height` above the floor. */
  const onPlane = (clientX: number, clientY: number, height: number) => {
    const box = canvas.getBoundingClientRect();
    const nx = ((clientX - box.left) / box.width) * 2 - 1;
    const ny = 1 - ((clientY - box.top) / box.height) * 2;
    const t = view.distance - height;
    return [nx * view.tan * view.aspect * t, height, -ny * view.tan * t];
  };

  /** The particle under a point on the screen, the uppermost if layers overlap. */
  const particleAt = (clientX: number, clientY: number) => {
    const box = canvas.getBoundingClientRect();
    const reach = Math.max(14, (box.width * share) / (COLUMNS - 1)) ** 2;
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

  // --- Motion ------------------------------------------------------------

  let frame = 0;
  let last = 0;
  let behind = 0;
  /** How long, in seconds, nothing has moved enough to see. */
  let quiet = 0;
  /** How long, in seconds, since it was last let go of. */
  let idle = 0;
  /** How much of it is woven, from 0 to 1, and whether it can be picked up. */
  let woven = 0;
  let ready = false;
  let disturbed = false;
  const hold = { pointer: -1, offset: [0, 0], lifted: 0, from: 0, trail: [] as { t: number; p: number[] }[] };

  /**
   * The corner nearest the visitor (lowest and furthest right on screen) is
   * turned up a little at rest, as a rug's corner often is, and rises towards
   * a hand that comes near: an invitation to lift it. Underneath is the
   * message (Rug.astro).
   */
  const curl = { on: false, corner: -1, flat: [0, 0, 0], inward: [0, 0], level: 0, goal: 0 };
  /**
   * A move made for the visitor (the "Lift the rug" button): the corner led
   * along a path, and then let go, or, with `keep`, held where it ends.
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
  let liftWanted = false;

  const setState = (state: 'weaving' | 'moving' | 'resting') => {
    if (stage.dataset.state !== state) stage.dataset.state = state;
  };

  /** Finds the corner nearest the visitor and where it lies flat. */
  const findCorner = () => {
    const corners = [0, COLUMNS - 1, (ROWS - 1) * COLUMNS, ROWS * COLUMNS - 1];
    let best = corners[0];
    for (const i of corners) {
      if (cloth.position[i * 3] + cloth.position[i * 3 + 2] > cloth.position[best * 3] + cloth.position[best * 3 + 2]) best = i;
    }
    curl.corner = best;
    curl.flat = Array.from(cloth.position.subarray(best * 3, best * 3 + 3));
    // In towards the middle, so the turned-up corner leans over like a
    // dog-ear and shows a little of its back.
    const length = Math.hypot(curl.flat[0], curl.flat[2]) || 1;
    curl.inward = [(-curl.flat[0] / length) * 0.16, (-curl.flat[2] / length) * 0.16];
  };

  const curlTo = (level: number) => {
    const e = level / CURL_NEAR;
    cloth.target[0] = curl.flat[0] + curl.inward[0] * e;
    cloth.target[1] = curl.flat[1] + level;
    cloth.target[2] = curl.flat[2] + curl.inward[1] * e;
  };

  /** Turns the corner up (or, with `goal`, to a new height). */
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

  /** Lets the turned-up corner go, before a hand takes the rug or a move is made. */
  const uncurl = () => {
    if (!curl.on) return;
    curl.on = false;
    cloth.hold(null);
  };

  const loop = (time: number) => {
    frame = 0;
    if (document.hidden) return;
    const dt = Math.min((time - (last || time)) / 1000, 0.05);
    // The time that has really passed: where frames are slow, the cloth falls
    // behind it, but its rest is still counted in seconds as they pass.
    const passed = Math.min((time - (last || time)) / 1000, 0.5);
    last = time;
    behind += dt;
    let steps = 0;
    while (behind >= STEP && steps < 2) {
      if (hold.pointer >= 0) {
        // Lift what is held, smoothly, to a hand's height.
        hold.lifted = Math.min(1, hold.lifted + STEP / 0.15);
        const eased = 1 - (1 - hold.lifted) ** 3;
        cloth.target[1] = hold.from + (LIFT - hold.from) * eased;
      } else if (script) {
        // The corner along its path: eased, and raised in an arc on the way.
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
        // The turned-up corner eases to its height.
        curl.level += (curl.goal - curl.level) * 0.09;
        curlTo(curl.level);
      }
      cloth.step(STEP);
      behind -= STEP;
      steps++;
    }
    idle = hold.pointer < 0 && !script ? idle + passed : 0;
    if (steps === 2) behind = 0;
    draw();
    // At rest when nothing has moved more than about half a pixel a frame for
    // a third of a second, or, after five seconds untouched, when nothing is
    // visibly moving at all: folded double, the layers can keep a tremor too
    // small to see, which is not worth a running loop. A corner turned up, once
    // it has risen, only sags by fractions of a pixel: that, too, is rest.
    const easing = curl.on && Math.abs(curl.goal - curl.level) > 0.0005;
    const settled = curl.on ? 0.004 : 0.0015;
    // Counted in time, not frames: on a slow device frames are few and far between.
    quiet = hold.pointer < 0 && !script && !easing && cloth.motion < settled ? quiet + passed : 0;
    if (quiet > 0.33 || (idle > 5 && cloth.motion < 0.01)) {
      last = 0;
      behind = 0;
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

  const rest = () => {
    uncurl();
    script = null;
    cloth.hold(null);
    cloth.layFlat(0, 0, restAngle);
    disturbed = false;
    setLifted(false);
  };

  const setLifted = (value: boolean) => {
    lifted = value;
    stage.toggleAttribute('data-lifted', value);
    stage.dispatchEvent(new CustomEvent('rug:lifted', { detail: value, bubbles: true }));
  };

  /**
   * The "Lift the rug" button: the corner is taken up and laid over towards
   * the middle, so what is written under it shows; pressed again, it is put
   * back where it was.
   */
  const toggleLift = () => {
    if (!ready || hold.pointer >= 0 || script) return;
    if (still.matches) {
      // Without motion, the flat picture is moved aside instead (Rug.astro).
      setLifted(!lifted);
      return;
    }
    if (!lifted) {
      uncurl();
      findCorner();
      cloth.hold(curl.corner);
      const from = Array.from(cloth.position.subarray(curl.corner * 3, curl.corner * 3 + 3));
      // Over a little past the middle, a fold's thickness up, and held there:
      // a rug's stiffness would otherwise turn the corner back.
      const to = [from[0] * -0.22, 0.025, from[2] * -0.22];
      script = { from, to, peak: 0.24, t: 0, duration: 1.35, keep: true, done: () => undefined };
      disturbed = true;
      setLifted(true);
    } else {
      // Back: the folded corner (now near the middle) is carried home and set down.
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

  // Picking up and letting go.
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

  const pickUp = (event: PointerEvent, particle: number) => {
    if (particle < 0 || script) return;
    uncurl();
    // Taken in hand, a corner laid over is not held there any more.
    if (lifted) setLifted(false);
    idle = 0;
    cloth.hold(particle);
    hold.pointer = event.pointerId;
    hold.lifted = 0;
    hold.from = cloth.position[particle * 3 + 1];
    hold.trail = [];
    const p = onPlane(event.clientX, event.clientY, hold.from);
    hold.offset = [cloth.position[particle * 3] - p[0], cloth.position[particle * 3 + 2] - p[2]];
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // The pointer may already be gone.
    }
    stage.setAttribute('data-holding', '');
    // Picked up: someone has looked under it (plane.ts).
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
      velocity = end.p.map((value, i) => clamp((value - first.p[i]) / seconds, -3, 3));
    }
    cloth.release(velocity[0], 0, velocity[2], STEP);
    hold.pointer = -1;
    stage.removeAttribute('data-holding');
    wake();
  };

  let press = 0;
  let pressAt = [0, 0];
  canvas.addEventListener('pointerdown', (event) => {
    if (still.matches || !ready || hold.pointer >= 0 || event.button > 0) return;
    const particle = particleAt(event.clientX, event.clientY);
    if (particle < 0) return;
    if (event.pointerType === 'touch') {
      // On a touch screen, press and hold to pick it up; a swipe still scrolls.
      pressAt = [event.clientX, event.clientY];
      window.clearTimeout(press);
      press = window.setTimeout(() => {
        press = 0;
        pickUp(event, particleAt(pressAt[0], pressAt[1]));
      }, 260);
      return;
    }
    event.preventDefault();
    pickUp(event, particle);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (press && Math.hypot(event.clientX - pressAt[0], event.clientY - pressAt[1]) > 8) {
      window.clearTimeout(press);
      press = 0;
    }
    pressAt = [event.clientX, event.clientY];
    if (event.pointerId === hold.pointer) {
      lead(event);
      wake();
    } else if (event.pointerType !== 'touch' && ready && !still.matches) {
      stage.toggleAttribute('data-over', particleAt(event.clientX, event.clientY) >= 0);
      // A hand near the turned-up corner: it rises to meet it.
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
    window.clearTimeout(press);
    press = 0;
    if (event.pointerId === hold.pointer) letGo();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  canvas.addEventListener('pointerleave', () => {
    stage.removeAttribute('data-over');
    if (curl.on && curl.goal !== CURL) curlUp(CURL);
  });
  // While it is held on a touch screen, the page does not scroll.
  canvas.addEventListener(
    'touchmove',
    (event) => {
      if (hold.pointer >= 0) event.preventDefault();
    },
    { passive: false },
  );
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // --- Life --------------------------------------------------------------

  /**
   * The first time it is seen, it is woven: a row at a time from the bottom
   * up, slowly at first, then at a weaver's pace, slowing again for the last
   * rows. Then it can be picked up.
   */
  let begun = false;
  const weaveIn = () => {
    begun = true;
    if (still.matches) {
      woven = 1;
      ready = true;
      draw();
      setState('resting');
      if (liftWanted) toggleLift();
      return;
    }
    setState('weaving');
    let start = 0;
    const row = (time: number) => {
      if (document.hidden) {
        start = 0;
        document.addEventListener('visibilitychange', () => requestAnimationFrame(row), { once: true });
        return;
      }
      start ||= time - woven * WEAVING * 1000;
      const t = Math.min(1, (time - start) / (WEAVING * 1000));
      woven = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      draw();
      if (t < 1) {
        requestAnimationFrame(row);
        return;
      }
      woven = 1;
      ready = true;
      draw();
      setState('resting');
      // Woven: a moment later, its corner turns up (or, if the button was
      // pressed while the flat picture still lay here, it is lifted).
      window.setTimeout(() => (liftWanted ? toggleLift() : curlUp()), 650);
    };
    requestAnimationFrame(row);
  };

  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !begun && entry.intersectionRatio >= 0.35) weaveIn();
      // Played with and then scrolled away: laid straight for next time.
      if (!entry.isIntersecting && ready && disturbed && hold.pointer < 0 && !script) {
        rest();
        draw();
        setState('resting');
      }
      // Back in view and lying straight: the corner turns up again.
      if (entry.isIntersecting && entry.intersectionRatio >= 0.35 && ready && !disturbed && !curl.on) {
        window.setTimeout(() => curlUp(), 400);
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

  // Until it is woven, the warp lies ready on the page. If the flat picture
  // was lifted (rug.ts) before this scene was ready, the rug is lifted once
  // it is woven, so the press is not lost.
  liftWanted = stage.hasAttribute('data-lifted');
  readTheme();
  layout();
  rest();
  if (still.matches) weaveIn();
  else draw();
  stage.setAttribute('data-live', '');
  return true;
}

// Splits Hevalo's app icon into the layers of the 3D deer in the products section
// (HevaloDeer.astro), where the icon is a hole in the page with the deer emerging: the cast shadow,
// the neck (inside the hole), the antlers, each ear, the head (with the Christmas scarf) and the
// nose, plus the Christmas snowflakes behind it. The purple backdrop is drawn by the page. Uses the
// eyeless sources, since the pupils are drawn by the page too.
//
// Each layer contains only the deer's pixels, with edge pixels unmixed from the purple, and layers
// behind the head extend slightly underneath it in their own color, so no gaps open when they move
// apart. Resampled with the Mitchell filter, which doesn't ring (no light or dark halos at edges).
// Writes WebP at frame widths 288 and 576 (the soft shadow at 144) to src/assets/brand/deer and
// prints each layer's box in units of the 360px frame, for HevaloDeer.astro.
//
// Usage: node scripts/deer-layers.cjs [debugDir]
const { Buffer } = require('node:buffer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../src/assets/brand/deer');
const DEBUG = process.argv[2];
const FRAME = { left: 70, top: 64, width: 360 };
const SEASONS = [
  { season: 'everyday', file: 'hevalo', source: 'hevalo-eyeless-source.png', height: 360 },
  { season: 'christmas', file: 'hevalo-christmas', source: 'hevalo-christmas-eyeless-source.png', height: 412 },
];
const SRC_DIR = path.join(__dirname, '../src/assets/brand/');
const W = 360;
// Straight edges of the purple square in the frame, where alpha crosses 0.5 (measured on the
// sources away from the corners and the deer).
const SQUARE = { left: 13.72, right: 346.08, top: 0.27, bottom: 358.8 };
const AXIS = 359.9; // x' = AXIS - x mirrors horizontally

// --- Outlines in frame units, traced from the artwork ---
//
// creaseL: where the left ear goes under the head; dome: top of the head; jaw: cheek and chin
// outline over the neck (the shaded underside of the chin belongs to the head); notchL: through the
// purple gap between the left ear and antler. The right side mirrors the left.
const creaseL = [[69, 203], [72, 196], [75, 186], [79, 174], [84, 162], [91, 151], [100, 143]];
const dome = [[100, 143], [105, 140], [110, 135.5], [120, 130.5], [130, 127], [140, 124], [150, 122], [160, 120.5], [170, 119.5], [180, 119], [190, 119.5], [200, 120.5], [210, 122], [220, 124], [230, 127], [240, 131], [250, 136], [255, 139.5], [259.9, 143]];
const mirror = (points) => points.map(([x, y]) => [AXIS - x, y]);
const creaseR = mirror(creaseL).reverse(); // top to bottom
const jaw = [[262, 321], [247, 320.5], [238, 329], [228, 336.5], [220, 343], [210, 349], [200, 354], [190, 357], [180, 358.6], [170, 357], [160, 354], [150, 349], [140, 343], [132, 336.5], [122, 329], [113, 320.5], [98, 321]];
const notchL = [[-20, 85], [40, 90], [60, 98], [75, 106], [90, 117], [98, 127], [101, 135], [100, 143]];

const poly = (points) => points.map(([x, y]) => `${x},${y}`).join(' ');

function regions(domeLift) {
  const d = dome.map(([x, y], i) => [x, i === 0 || i === dome.length - 1 ? y : y - domeLift]);
  // The jaw's endpoints extend into the purple beside the neck, so the whole cheek counts as head.
  const head = [[-20, 203], ...creaseL, ...d.slice(1, -1), ...creaseR, [380, 203], [380, 321], ...jaw, [-20, 321]];
  const neck = [[-20, 321], ...jaw.slice().reverse(), [380, 321], [380, 440], [-20, 440]];
  const earL = [...notchL, ...creaseL.slice().reverse(), [-20, 203]];
  const earR = mirror(earL);
  return { head, neck, earL, earR, dome: d };
}

async function rasterise(points, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}"><polygon points="${poly(points)}" fill="#fff"/></svg>`;
  const { data } = await sharp(Buffer.from(svg)).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  return Float32Array.from(data, (v) => v / 255);
}

function dilate(mask, width, height, r) {
  const tmp = new Float32Array(mask.length);
  const out = new Float32Array(mask.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(width - 1, x + r); k++) m = Math.max(m, mask[y * width + k]);
      tmp[y * width + x] = m;
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let m = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(height - 1, y + r); k++) m = Math.max(m, tmp[k * width + x]);
      out[y * width + x] = m;
    }
  return out;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Least-squares fit of a quadratic in x and y.
function fitQuadratic(samples) {
  const n = 6;
  const A = Array.from({ length: n }, () => new Float64Array(n + 3));
  for (const [x, y, r, g, b] of samples) {
    const u = x / 180 - 1, v = y / 180 - 1;
    const f = [1, u, v, u * u, v * v, u * v];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += f[i] * f[j];
      A[i][n] += f[i] * r;
      A[i][n + 1] += f[i] * g;
      A[i][n + 2] += f[i] * b;
    }
  }
  // Gauss-Jordan elimination
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      for (let j = c; j < n + 3; j++) A[r][j] -= k * A[c][j];
    }
  }
  const coef = [0, 1, 2].map((ch) => A.map((row, i) => row[n + ch] / row[i]));
  return (x, y) => {
    const u = x / 180 - 1, v = y / 180 - 1;
    const f = [1, u, v, u * u, v * v, u * v];
    return coef.map((c) => c.reduce((s, ci, i) => s + ci * f[i], 0));
  };
}

// Coverage of a pixel by the purple square: along the straight sides, the source's own edge profile
// (measured where nothing overlaps, so it's the same under the deer as beside it); in the corners,
// the source alpha.
function squareCoverage(SA, H) {
  const at = (x, y) => SA[y * W + x];
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const rows = Array.from({ length: 51 }, (_, k) => 220 + k);
  const left = Array.from({ length: 40 }, (_, x) => mean(rows.map((y) => at(x, y))));
  const right = Array.from({ length: 40 }, (_, k) => mean(rows.map((y) => at(W - 40 + k, y))));
  const cols = [...Array.from({ length: 11 }, (_, k) => 90 + k), ...Array.from({ length: 11 }, (_, k) => 260 + k)];
  const top = Array.from({ length: 10 }, (_, y) => mean(Array.from({ length: 61 }, (_, k) => at(150 + k, y))));
  const bottom = Array.from({ length: 20 }, (_, k) => mean(cols.map((x) => at(x, 340 + k))));
  const S = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sideRows = y >= 70 && y <= 285;
      const sideCols = x >= 85 && x <= 275;
      if (!sideRows && !sideCols) {
        S[y * W + x] = at(x, y);
        continue;
      }
      let c = 1;
      if (sideRows && x < 40) c *= left[x];
      if (sideRows && x >= W - 40) c *= right[x - (W - 40)];
      if (sideCols && y < 10) c *= top[y];
      if (sideCols && y >= 340) c *= y < 360 ? bottom[y - 340] : 0;
      S[y * W + x] = c;
    }
  return S;
}

async function layersFor({ season, source, height: H }) {
  const { data: raw, info } = await sharp(path.join(SRC_DIR, source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = W * H;
  const P = new Float32Array(N * 3); // premultiplied color, 0..255
  const SA = new Float32Array(N); // source alpha 0..1
  const C = new Float32Array(N * 3); // straight color
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = x + FRAME.left, sy = y + FRAME.top;
      const i = y * W + x;
      if (sy >= info.height) continue;
      const j = (sy * info.width + sx) * 4;
      const a = raw[j + 3] / 255;
      SA[i] = a;
      for (let c = 0; c < 3; c++) {
        C[i * 3 + c] = raw[j + c];
        P[i * 3 + c] = raw[j + c] * a;
      }
    }

  // Purple background: a smooth gradient fitted to clearly purple pixels.
  const samples = [];
  for (let y = 4; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      const i = y * W + x;
      if (SA[i] < 0.999) continue;
      const [r, g, b] = [C[i * 3], C[i * 3 + 1], C[i * 3 + 2]];
      if (b - g > 70 && r - g > 25 && b > 170 && g < 150) samples.push([x, y, r, g, b]);
    }
  const bgAt = fitQuadratic(samples);
  const B = new Float32Array(N * 3);
  let residual = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) B.set(bgAt(x + 0.5, y + 0.5), (y * W + x) * 3);
  for (const [x, y, r, g, b] of samples) {
    const [br, bg, bb] = bgAt(x + 0.5, y + 0.5);
    residual += Math.hypot(r - br, g - bg, b - bb);
  }
  console.log(season, 'background fit on', samples.length, 'px, mean residual', (residual / samples.length).toFixed(2));
  const hex = (rgb) => '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
  console.log(season, 'purple: top left', hex(bgAt(14, 1)), 'top right', hex(bgAt(346, 1)), 'bottom left', hex(bgAt(14, 358)), 'bottom right', hex(bgAt(346, 358)), 'centre', hex(bgAt(180, 180)));

  // Initial hard deer mask: far from the purple inside the square, or opaque outside it.
  const S = squareCoverage(SA, H);
  const core = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = Math.hypot(C[i * 3] - B[i * 3], C[i * 3 + 1] - B[i * 3 + 1], C[i * 3 + 2] - B[i * 3 + 2]);
      if (SA[i] > 0.5 && (S[i] < 0.5 || d > 75)) core[i] = 1;
    }
  // The source has a faint fringe along the square's edges. There, a pixel is deer only if the deer
  // continues 3px further in (an ear crossing the edge, or the neck reaching it).
  const solid = (x, y) => {
    const i = y * W + x;
    return SA[i] > 0.98 && Math.hypot(C[i * 3] - B[i * 3], C[i * 3 + 1] - B[i * 3 + 1], C[i * 3 + 2] - B[i * 3 + 2]) > 75;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!core[i]) continue;
      let inward = null;
      if (Math.abs(x + 0.5 - SQUARE.left) < 2.5) inward = [x + 3, y];
      else if (Math.abs(x + 0.5 - SQUARE.right) < 2.5) inward = [x - 3, y];
      else if (Math.abs(y + 0.5 - SQUARE.top) < 2.5) inward = [x, y + 3];
      else if (Math.abs(y + 0.5 - SQUARE.bottom) < 2.5) inward = [x, y - 3];
      if (inward && !(SA[i] > 0.98 && solid(...inward))) core[i] = 0;
    }
  // Connected components: keep the deer and anything touching it (the Christmas lights); drop the
  // snowflakes.
  const label = new Int32Array(N).fill(-1);
  const sizes = [];
  for (let i = 0; i < N; i++) {
    if (!core[i] || label[i] >= 0) continue;
    const id = sizes.length;
    let count = 0;
    const stack = [i];
    label[i] = id;
    while (stack.length) {
      const k = stack.pop();
      count++;
      const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (core[n] && label[n] < 0) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    sizes.push(count);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  const mainMask = Float32Array.from(label, (l) => (l === main ? 1 : 0));
  const near = dilate(mainMask, W, H, 4);
  const keep = new Set([main]);
  for (let i = 0; i < N; i++) if (label[i] >= 0 && near[i] > 0 && sizes[label[i]] < 4000) keep.add(label[i]);
  for (let i = 0; i < N; i++) if (core[i] && !keep.has(label[i])) core[i] = 0;
  console.log(season, 'parts', sizes.length, 'kept', keep.size);

  // Soft edges: unmix each edge pixel between the nearby deer color and the background beneath it.
  const coreF = Float32Array.from(core);
  const band = dilate(coreF, W, H, 2);
  const A = new Float32Array(N);
  const F = new Float32Array(N * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!band[i]) continue;
      // Deep inside: use the pixel as is.
      let interior = true;
      for (let dy = -1; dy <= 1 && interior; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || !core[ny * W + nx]) {
            interior = false;
            break;
          }
        }
      if (interior) {
        A[i] = SA[i];
        for (let c = 0; c < 3; c++) F[i * 3 + c] = C[i * 3 + c];
        if (S[i] > 0 && SA[i] < 1) A[i] = 1; // opaque deer over the square's own edge
        continue;
      }
      // Local deer color: mean of core pixels within 3px, away from the edge.
      let fr = 0, fg = 0, fb = 0, fw = 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (!core[n] || SA[n] < 0.98) continue;
          const w = 1 / (1 + dx * dx + dy * dy);
          fr += C[n * 3] * w;
          fg += C[n * 3 + 1] * w;
          fb += C[n * 3 + 2] * w;
          fw += w;
        }
      if (!fw) continue;
      const f = [fr / fw, fg / fw, fb / fw];
      const bp = [B[i * 3] * S[i], B[i * 3 + 1] * S[i], B[i * 3 + 2] * S[i]];
      let num = 0, den = 0;
      for (let c = 0; c < 3; c++) {
        num += (P[i * 3 + c] - bp[c]) * (f[c] - bp[c]);
        den += (f[c] - bp[c]) ** 2;
      }
      let a = den > 1 ? num / den : 0;
      a = Math.min(1, Math.max(0, a));
      if (a < 0.06) continue;
      A[i] = a;
      // Use the exact unmixed color, (P - (1 - a) * bp) / a, where the pixel is mostly deer; toward
      // the faint outer edge, where that division would amplify tiny errors into a light halo, fall
      // back to the nearby deer color.
      const trust = smooth(0.45, 0.9, a);
      for (let c = 0; c < 3; c++) {
        const unmixed = Math.min(255, Math.max(0, (P[i * 3 + c] - (1 - a) * bp[c]) / a));
        F[i * 3 + c] = f[c] + (unmixed - f[c]) * trust;
      }
    }

  // --- Parts ---
  const lift = season === 'christmas' ? 7 : 0;
  const r = regions(lift);
  const head0 = await rasterise(r.head, H);
  const neck = await rasterise(r.neck, H);
  const earL = await rasterise(r.earL, H);
  const earR = await rasterise(r.earR, H);
  const lumAt = (i) => (0.2126 * F[i * 3] + 0.7152 * F[i * 3 + 1] + 0.0722 * F[i * 3 + 2]) / 255;
  for (let i = 0; i < N; i++) {
    const dark = smooth(0.36, 0.28, lumAt(i));
    earL[i] *= 1 - dark;
    earR[i] *= 1 - dark;
  }
  // Antlers: everything that isn't head, neck or ear.
  const head = new Float32Array(N);
  const antlers = new Float32Array(N);
  // Near the top of the head, split by color: dark is antler, light is head.
  const domeY = (x) => {
    const d = r.dome;
    if (x <= d[0][0]) return d[0][1];
    for (let k = 1; k < d.length; k++) if (x <= d[k][0]) return d[k - 1][1] + ((x - d[k - 1][0]) / (d[k][0] - d[k - 1][0])) * (d[k][1] - d[k - 1][1]);
    return d[d.length - 1][1];
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let h = head0[i];
      if (x > 100 && x < 260 && Math.abs(y + 0.5 - domeY(x + 0.5)) < 4 + lift) {
        // The deer's own color (unmixed from the purple at the edges).
        const lum = (0.2126 * F[i * 3] + 0.7152 * F[i * 3 + 1] + 0.0722 * F[i * 3 + 2]) / 255;
        h = 1 - smooth(0.42, 0.3, lum);
        if (season === 'christmas') {
          // Snow (light gray-white) and fur (orange) belong to the head; antlers, wire and colored
          // bulbs to the antlers.
          const [cr, cg, cb] = [F[i * 3], F[i * 3 + 1], F[i * 3 + 2]];
          const max = Math.max(cr, cg, cb), min = Math.min(cr, cg, cb);
          const snow = min > 165 && max - min < 70;
          const fur = cr > cg && cg > cb && cr > 150 && (cg - cb) / Math.max(1, cr - cb) > 0.25 && (cg - cb) / Math.max(1, cr - cb) < 0.75;
          h = snow || fur ? h : 0;
        }
        if (y + 0.5 > domeY(x + 0.5) + 2) h = Math.max(h, head0[i]);
      }
      if (season === 'christmas') {
        // The scarf hangs from the head over the neck: one layer.
        h = Math.max(h, neck[i]);
        neck[i] = 0;
      }
      head[i] = h;
      antlers[i] = Math.max(0, 1 - h - neck[i] - earL[i] - earR[i]);
    }

  // Nose: the dark area of the everyday nose above the mouth (identical at Christmas, with snow on
  // top).
  const nose0 = new Float32Array(N);
  const everydayNose = layersFor.nose;
  if (!everydayNose) {
    for (let y = 268; y < 324; y++)
      for (let x = 140; x < 222; x++) {
        const i = y * W + x;
        const lum = (0.2126 * C[i * 3] + 0.7152 * C[i * 3 + 1] + 0.0722 * C[i * 3 + 2]) / 255;
        // Nose coverage: interpolate between the nose's dark brown (luminance ~0.25) and the
        // muzzle's light tan (~0.75).
        nose0[i] = Math.min(1, Math.max(0, (0.75 - lum) / 0.5)) * (1 - smooth(316, 322, y));
      }
    // Solid within its outline: the highlight on top is part of the nose, not a hole that would
    // reveal the face's nose once it lifts off.
    const outside = new Uint8Array(N);
    const stack = [];
    for (let y = 266; y < 326; y++)
      for (let x = 138; x < 224; x++)
        if ((y === 266 || y === 325 || x === 138 || x === 223) && nose0[y * W + x] < 0.5) {
          outside[y * W + x] = 1;
          stack.push(y * W + x);
        }
    while (stack.length) {
      const k = stack.pop();
      const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 138 || nx > 223 || ny < 266 || ny > 325) continue;
        const n = ny * W + nx;
        if (!outside[n] && nose0[n] < 0.5) {
          outside[n] = 1;
          stack.push(n);
        }
      }
    }
    const deep = new Uint8Array(N);
    for (let y = 267; y < 325; y++)
      for (let x = 139; x < 223; x++) {
        const i = y * W + x;
        if (outside[i]) continue;
        const edge = outside[i - 1] || outside[i + 1] || outside[i - W] || outside[i + W];
        if (!edge) {
          nose0[i] = 1;
          deep[i] = 1;
        }
      }
    layersFor.nose = nose0;
    layersFor.noseDeep = deep;
  } else nose0.set(everydayNose);
  let nose = nose0;
  if (season === 'christmas') {
    // The snow on top of the nose.
    nose = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) nose[y * W + x] = Math.max(...[0, 1, 2, 3, 4, 5, 6].map((k) => (y + k < H ? nose0[(y + k) * W + x] : 0)));
  }

  // Layers behind extend slightly under the head so no gaps open when they move apart: antlers and
  // ears continue in their own color (each edge pixel's color, averaged along the edge to avoid
  // streaks); the neck continues straight up behind the chin.
  const ext = (weight, dir, reach, flat) => {
    const colour = new Float32Array(N * 3);
    const alpha = new Float32Array(N);
    const [dx, dy] = dir;
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const solid = (x, y) => inside(x, y) && A[y * W + x] * weight[y * W + x] >= 0.5;
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      if (!solid(x, y) || solid(x + dx, y + dy)) continue;
      const n = (y + dy) * W + (x + dx);
      if (!inside(x + dx, y + dy) || head[n] < 0.5) continue;
      // Color 2-4px inside the edge, averaged over 5px along it.
      let fill = flat;
      if (!fill) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let along = -2; along <= 2; along++)
          for (let depth = 2; depth <= 4; depth++) {
            const sx = x - dx * depth + dy * along, sy = y - dy * depth + dx * along;
            if (!solid(sx, sy)) continue;
            const k = sy * W + sx;
            r += F[k * 3]; g += F[k * 3 + 1]; b += F[k * 3 + 2]; count++;
          }
        fill = count ? [r / count, g / count, b / count] : [F[i * 3], F[i * 3 + 1], F[i * 3 + 2]];
      }
      for (let k = 1; k <= reach; k++) {
        const tx = x + dx * k, ty = y + dy * k;
        if (!inside(tx, ty)) break;
        const t = ty * W + tx;
        if (head[t] < 0.3 || A[t] < 0.5) break;
        if (alpha[t] >= 1) continue;
        alpha[t] = 1;
        colour.set(fill, t * 3);
      }
    }
    return { colour, alpha };
  };

  // Neck behind the chin: each neck column extended straight up from just below the jaw, colors
  // smoothed horizontally, as far under the head as the head can ever move.
  const neckUnder = () => {
    const colour = new Float32Array(N * 3);
    const alpha = new Float32Array(N);
    const columns = [];
    for (let x = 0; x < W; x++) {
      let y0 = -1;
      for (let y = 280; y < H - 1; y++) if (A[y * W + x] * neck[y * W + x] >= 0.5) { y0 = y; break; }
      if (y0 < 0) continue;
      const sy = Math.min(y0 + 2, Math.floor(SQUARE.bottom) - 1);
      const k = sy * W + x;
      columns.push({ x, y0, rgb: A[k] * neck[k] >= 0.5 ? [F[k * 3], F[k * 3 + 1], F[k * 3 + 2]] : null, a: A[y0 * W + x] * neck[y0 * W + x] });
    }
    // Columns with no neck pixel below the jaw (where the chin reaches the tile edge) take their
    // neighbors' color; then a light horizontal blur.
    const known = columns.filter((c) => c.rgb);
    for (const c of columns) {
      if (c.rgb) continue;
      const left = [...known].reverse().find((k) => k.x < c.x), right = known.find((k) => k.x > c.x);
      const a = left ?? right, b = right ?? left;
      const t = a === b ? 0 : (c.x - a.x) / (b.x - a.x);
      c.rgb = a.rgb.map((v, ch) => v + (b.rgb[ch] - v) * t);
    }
    const smoothRgb = columns.map((c, index) => {
      let sum = [0, 0, 0], weight = 0;
      for (let d = -3; d <= 3; d++) {
        const o = columns[index + d];
        if (!o || Math.abs(o.x - c.x) > 3) continue;
        const w = Math.exp(-(d * d) / 4.5);
        sum = sum.map((v, ch) => v + o.rgb[ch] * w);
        weight += w;
      }
      return sum.map((v) => v / weight);
    });
    columns.forEach((c, index) => {
      for (let y = c.y0 - 1; y >= c.y0 - 30; y--) {
        const t = y * W + c.x;
        if (y < 0 || head[t] < 0.3 || A[t] < 0.5) break;
        alpha[t] = Math.min(1, c.a);
        colour.set(smoothRgb[index], t * 3);
      }
    });
    return { colour, alpha };
  };

  const extensions = {
    antlers: ext(antlers, [0, 1], 10, [74, 45, 39]),
    'ear-left': ext(earL, [1, 0], 10),
    'ear-right': ext(earR, [-1, 0], 10),
    neck: neckUnder(),
  };

  const layers = {};
  const make = (name, weight, extension) => {
    const out = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const a = A[i] * Math.min(1, weight[i]);
      if (extension && extension.alpha[i] > a) {
        out.set([extension.colour[i * 3], extension.colour[i * 3 + 1], extension.colour[i * 3 + 2], extension.alpha[i]], i * 4);
        continue;
      }
      if (a <= 0.004) continue;
      out.set([F[i * 3], F[i * 3 + 1], F[i * 3 + 2], a], i * 4);
    }
    // Faint specks away from the layer's own shape (edges of a neighboring part) would visibly
    // drift once layers separate: drop them.
    const strong = new Float32Array(N);
    for (let i = 0; i < N; i++) strong[i] = out[i * 4 + 3] > 0.5 ? 1 : 0;
    const near = dilate(strong, W, H, 2);
    for (let i = 0; i < N; i++) if (!near[i]) out[i * 4 + 3] = 0;
    layers[name] = out;
  };
  make('antlers', antlers, extensions.antlers);
  make('ear-left', earL, extensions['ear-left']);
  make('ear-right', earR, extensions['ear-right']);
  make('head', head);
  make('nose', nose);
  // The nose's soft rim takes the nose's dark color (in the artwork it's half muzzle, which would
  // show as a light ring once the nose lifts off); the Christmas snow on top keeps its own.
  {
    const out = layers.nose;
    const deep = layersFor.noseDeep;
    for (let i = 0; i < N; i++) {
      if (out[i * 4 + 3] === 0 || deep[i]) continue;
      const lum = (0.2126 * F[i * 3] + 0.7152 * F[i * 3 + 1] + 0.0722 * F[i * 3 + 2]) / 255;
      if (season === 'christmas' && lum > 0.6 && nose0[i] < 0.5) continue;
      const x = i % W, y = (i / W) | 0;
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const k = (y + dy) * W + (x + dx);
          if (deep[k]) { r += F[k * 3]; g += F[k * 3 + 1]; b += F[k * 3 + 2]; count++; }
        }
      if (count) out.set([r / count, g / count, b / count], i * 4);
    }
  }

  // Christmas snowflakes on their own layer: white, unmixed from the purple.
  if (season === 'christmas') {
    const snow = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      if (A[i] > 0 || band[i] > 0 || SA[i] <= 0.5 || S[i] <= 0.99) continue;
      let num = 0, den = 0;
      for (let c = 0; c < 3; c++) {
        num += (C[i * 3 + c] - B[i * 3 + c]) * (255 - B[i * 3 + c]);
        den += (255 - B[i * 3 + c]) ** 2;
      }
      const w = Math.min(1, Math.max(0, num / den));
      if (w > 0.05) snow.set([255, 255, 255, w], i * 4);
    }
    layers.snow = snow;
  }

  // Neck (everyday deer only; the Christmas scarf hides it), as drawn below the jaw and extended up
  // under the head. HevaloDeer.astro draws it inside the hole, moving with the head, so it must be
  // complete wherever the hole can reveal it: under the chin, where the artwork has none (each row
  // is filled from the neck on either side), and below the tile's edge (it continues straight down,
  // so the layer is taller than the artwork; the hole hides that part). Long enough to reach below
  // the hole's edge at any depth as the deer emerges.
  if (season === 'everyday') {
    const NH = H + 180;
    const neckLayer = new Float32Array(W * NH * 4);
    for (let i = 0; i < N; i++) {
      const a = A[i] * neck[i];
      const e = extensions.neck.alpha[i] * (1 - neck[i]);
      if (e > a) neckLayer.set([...extensions.neck.colour.subarray(i * 3, i * 3 + 3), e], i * 4);
      else if (a > 0.004) neckLayer.set([F[i * 3], F[i * 3 + 1], F[i * 3 + 2], a], i * 4);
    }
    // Last row the artwork draws completely.
    const edge = Math.floor(SQUARE.bottom) - 3;
    for (let y = 280; y <= edge; y++) {
      const under = (x) => head[y * W + x] >= 0.3;
      const drawn = (x) => x >= 0 && x < W && !under(x) && neckLayer[(y * W + x) * 4 + 3] >= 0.9;
      for (let x = 1; x < W; x++) {
        if (!under(x) || !drawn(x - 1)) continue;
        let end = x;
        while (end < W && under(end)) end++;
        if (drawn(end)) {
          // From slightly inside the neck on either side, past the jaw's edge.
          const a = drawn(x - 3) ? x - 3 : x - 1;
          const b = drawn(end + 2) ? end + 2 : end;
          const l = (y * W + a) * 4, r = (y * W + b) * 4;
          for (let g = x; g < end; g++) {
            const t = (g - a) / (b - a);
            const m = (y * W + g) * 4;
            for (let c = 0; c < 3; c++) neckLayer[m + c] = neckLayer[l + c] + (neckLayer[r + c] - neckLayer[l + c]) * t;
            neckLayer[m + 3] = 1;
          }
        }
        x = end;
      }
    }
    for (let y = edge + 1; y < NH; y++) neckLayer.copyWithin(y * W * 4, edge * W * 4, (edge + 1) * W * 4);
    layers.neck = neckLayer;
  }

  // Cast shadow behind the deer: its silhouette, blurred and offset down and right, in black.
  const sil = new Float32Array(N);
  for (let i = 0; i < N; i++) sil[i] = A[i] * Math.min(1, head[i] + antlers[i] + earL[i] + earR[i]);
  const silBuf = Buffer.from(Uint8Array.from(sil, (v) => Math.round(v * 255)));
  const blurred = await sharp(silBuf, { raw: { width: W, height: H, channels: 1 } }).blur(6).extractChannel(0).raw().toBuffer();
  if (blurred.length !== N) throw new Error('shade: unexpected channels');
  const shade = new Float32Array(N * 4);
  const DX = 4, DY = 10;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = x - DX, sy = y - DY;
      if (sx < 0 || sy < 0) continue;
      const v = blurred[sy * W + sx] / 255;
      const i = y * W + x;
      const a = 0.3 * v;
      if (a < 0.004) continue;
      shade.set([0, 0, 0, a], i * 4);
    }
  layers.shade = shade;

  return { H, layers };
}

const toBuffer = (layer) => Buffer.from(Uint8ClampedArray.from(layer, (v, i) => (i % 4 === 3 ? Math.round(v * 255) : Math.round(v))));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (DEBUG) fs.mkdirSync(DEBUG, { recursive: true });
  const results = [];
  for (const s of SEASONS) results.push({ ...s, ...(await layersFor(s)) });

  // Union box per layer in frame units, snapped to a 5-unit grid (so 0.8x and 1.6x land on whole
  // pixels).
  const names = ['snow', 'shade', 'neck', 'antlers', 'ear-left', 'ear-right', 'head', 'nose'];
  const boxes = {};
  for (const name of names) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const { layers } of results) {
      const L = layers[name];
      if (!L) continue;
      for (let y = 0; y < L.length / 4 / W; y++)
        for (let x = 0; x < W; x++)
          if (L[(y * W + x) * 4 + 3] > 0.004) {
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
          }
    }
    const H = Math.max(...results.map((r) => (r.layers[name] ? r.layers[name].length / 4 / W : 0)));
    x0 = Math.max(0, Math.floor(x0 / 5) * 5); y0 = Math.max(0, Math.floor(y0 / 5) * 5);
    x1 = Math.min(W, Math.ceil(x1 / 5) * 5); y1 = Math.min(H + 3, Math.ceil(y1 / 5) * 5);
    boxes[name] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // Both seasons share one canvas so each layer has the same box in both. (The neck is
  // everyday-only and serves both.)
  const HMAX = Math.max(...results.map((r) => r.H)) + 8;
  for (const { season, file, layers } of results) {
    for (const [name, L] of Object.entries(layers)) {
      const box = boxes[name];
      const prefix = name === 'neck' ? 'hevalo' : file;
      const rows = Math.max(HMAX, L.length / 4 / W + 8);
      const padded = Buffer.alloc(W * rows * 4);
      toBuffer(L).copy(padded);
      const full = sharp(padded, { raw: { width: W, height: rows, channels: 4 } });
      const png = await full.png().toBuffer();
      for (const frame of name === 'shade' ? [144] : [288, 576]) {
        const k = frame / W;
        const scaled = await sharp(png).resize({ width: frame, height: Math.round(rows * k), kernel: 'mitchell' }).raw().toBuffer({ resolveWithObject: true });
        const h = Math.round(box.h * k);
        const out = path.join(OUT, `${prefix}-${name}-${frame}.webp`);
        // The resized pixels are straight alpha, not premultiplied, regardless of what the metadata
        // says: passing it on would divide the edges by alpha again.
        const res = await sharp(scaled.data, { raw: { width: scaled.info.width, height: scaled.info.height, channels: 4 } })
          .extract({ left: Math.round(box.x * k), top: Math.round(box.y * k), width: Math.round(box.w * k), height: h })
          .webp({ quality: name === 'shade' ? 70 : 84, alphaQuality: name === 'snow' ? 80 : 100, effort: 6, smartSubsample: true })
          .toFile(out);
        console.log(path.basename(out), `${res.width}x${res.height}`, res.size, 'B');
      }
      if (DEBUG) await sharp(toBuffer(L), { raw: { width: W, height: L.length / 4 / W, channels: 4 } }).png().toFile(path.join(DEBUG, `${season}-${name}.png`));
    }
  }
  console.log(JSON.stringify(boxes));
})();

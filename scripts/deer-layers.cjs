// Takes Hevalo's app icon apart into the layers of the 3D deer in the products
// section (HevaloDeer.astro): the face (the purple square, with the everyday
// deer's neck), the shade the deer casts on it, the antlers, each ear, the head
// (with the Christmas scarf) and the nose. Made from the eyeless sources, the
// pupils being drawn by the page.
//
// Each layer is the deer's own pixels, unmixed from the purple at their edges,
// and the layers behind the head reach a little under it in their own colour,
// so nothing opens up when they move apart. Resized with the Mitchell filter,
// which does not ring (a light or dark rim) at the edges. Writes WebP at frame widths 288
// and 576 (the shade, which is soft, at 144) into src/assets/brand/deer, and
// prints each layer's box in units of the 360 px frame, for HevaloDeer.astro.
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
// The purple square's straight edges in the frame (measured on the source's alpha).
const SQUARE = { left: 15.6, right: 344.3, top: 0.35, bottom: 358.6 };
const AXIS = 359.9; // x' = AXIS - x mirrors left and right

// ---- Outlines, in frame units, traced on the artwork ----
// creaseL: where the left ear goes under the head; dome: the top of the head;
// jaw: the chin and cheeks, above the neck; notchL: through the purple gap
// between the left ear and antler. The right side mirrors the left.
const creaseL = [[69, 203], [72, 196], [75, 186], [79, 174], [84, 162], [91, 151], [100, 143]];
const dome = [[100, 143], [105, 140], [110, 135.5], [120, 130.5], [130, 127], [140, 124], [150, 122], [160, 120.5], [170, 119.5], [180, 119], [190, 119.5], [200, 120.5], [210, 122], [220, 124], [230, 127], [240, 131], [250, 136], [255, 139.5], [259.9, 143]];
const mirror = (points) => points.map(([x, y]) => [AXIS - x, y]);
const creaseR = mirror(creaseL).reverse(); // from the top down
const jaw = [[259, 305], [247, 320], [235, 333], [220, 343], [200, 350], [180, 353], [160, 350], [140, 343], [125, 333], [112, 320], [100, 305]];
const notchL = [[-20, 85], [40, 90], [60, 98], [75, 106], [90, 117], [98, 127], [101, 135], [100, 143]];

const poly = (points) => points.map(([x, y]) => `${x},${y}`).join(' ');

function regions(domeLift) {
  const d = dome.map(([x, y], i) => [x, i === 0 || i === dome.length - 1 ? y : y - domeLift]);
  const head = [[-20, 203], ...creaseL, ...d.slice(1, -1), ...creaseR, [380, 203], [380, 305], ...jaw, [-20, 305]];
  const neck = [[-20, 305], ...jaw.slice().reverse(), [380, 305], [380, 440], [-20, 440]];
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

// Least squares for a quadratic in x, y.
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
  // Gauss-Jordan
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

const coverage = (x, y) => {
  const cx = Math.min(1, Math.max(0, x + 1 - SQUARE.left)) * Math.min(1, Math.max(0, SQUARE.right - x));
  const cy = Math.min(1, Math.max(0, y + 1 - SQUARE.top)) * Math.min(1, Math.max(0, SQUARE.bottom - y));
  return cx * cy;
};

async function layersFor({ season, source, height: H }) {
  const { data: raw, info } = await sharp(path.join(SRC_DIR, source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = W * H;
  const P = new Float32Array(N * 3); // premultiplied colour, 0..255
  const SA = new Float32Array(N); // source alpha 0..1
  const C = new Float32Array(N * 3); // straight colour
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

  // The purple background: a smooth gradient, fitted on clearly purple pixels.
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

  // A first, hard deer mask: far from the purple inside the square, or opaque
  // outside it.
  const S = new Float32Array(N);
  const core = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      S[i] = coverage(x, y);
      const d = Math.hypot(C[i * 3] - B[i * 3], C[i * 3 + 1] - B[i * 3 + 1], C[i * 3 + 2] - B[i * 3 + 2]);
      if (SA[i] > 0.5 && (S[i] < 0.5 || d > 75)) core[i] = 1;
    }
  // Along the square's edges the source has a faint fringe. There, a pixel is
  // deer only where the deer carries on 3 px further in (an ear crossing the
  // edge, the neck reaching it).
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
  // Connected parts: keep the deer, and whatever touches it (the Christmas
  // lights); drop snowflakes.
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

  // Soft edges: unmix each edge pixel between the deer's colour nearby and the
  // background under it.
  const coreF = Float32Array.from(core);
  const band = dilate(coreF, W, H, 2);
  const A = new Float32Array(N);
  const F = new Float32Array(N * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!band[i]) continue;
      // Deep inside: the pixel itself.
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
      // The deer's colour: mean of the core pixels within 3 px, away from the edge.
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
      // The colour that gives back the original, (P - (1 - a) * bp) / a, where
      // the pixel is mostly deer; towards the faint outside of the edge, where
      // that division would magnify the slightest error into a light halo,
      // the deer's colour nearby.
      const trust = smooth(0.45, 0.9, a);
      for (let c = 0; c < 3; c++) {
        const unmixed = Math.min(255, Math.max(0, (P[i * 3 + c] - (1 - a) * bp[c]) / a));
        F[i * 3 + c] = f[c] + (unmixed - f[c]) * trust;
      }
    }

  // ---- Parts ----
  const lift = season === 'christmas' ? 7 : 0;
  const r = regions(lift);
  const head0 = await rasterise(r.head, H);
  const neck = await rasterise(r.neck, H);
  const earL = await rasterise(r.earL, H);
  const earR = await rasterise(r.earR, H);
  const lumAt = (i) => (0.2126 * C[i * 3] + 0.7152 * C[i * 3 + 1] + 0.0722 * C[i * 3 + 2]) / 255;
  for (let i = 0; i < N; i++) {
    const dark = smooth(0.36, 0.28, lumAt(i));
    earL[i] *= 1 - dark;
    earR[i] *= 1 - dark;
  }
  // Antlers: whatever is not head, neck or ear.
  const head = new Float32Array(N);
  const antlers = new Float32Array(N);
  // Near the top of the head, follow the colour: dark is antler, light is head.
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
        const lum = (0.2126 * C[i * 3] + 0.7152 * C[i * 3 + 1] + 0.0722 * C[i * 3 + 2]) / 255;
        h = 1 - smooth(0.42, 0.3, lum);
        if (season === 'christmas') {
          // Snow (light, grey-white) and fur (orange) are head; antler,
          // wire and the coloured bulbs are antler.
          const [cr, cg, cb] = [C[i * 3], C[i * 3 + 1], C[i * 3 + 2]];
          const max = Math.max(cr, cg, cb), min = Math.min(cr, cg, cb);
          const snow = min > 165 && max - min < 70;
          const fur = cr > cg && cg > cb && cr > 150 && (cg - cb) / Math.max(1, cr - cb) > 0.25 && (cg - cb) / Math.max(1, cr - cb) < 0.75;
          h = snow || fur ? h : 0;
        }
        if (y + 0.5 > domeY(x + 0.5) + 2) h = Math.max(h, head0[i]);
      }
      if (season === 'christmas') {
        // The scarf hangs from the head, over the neck: one layer.
        h = Math.max(h, neck[i]);
        neck[i] = 0;
      }
      head[i] = h;
      antlers[i] = Math.max(0, 1 - h - neck[i] - earL[i] - earR[i]);
    }

  // Nose: the dark of the everyday nose, above the mouth (the same at
  // Christmas, with the snow on top of it).
  const nose0 = new Float32Array(N);
  const everydayNose = layersFor.nose;
  if (!everydayNose) {
    for (let y = 268; y < 324; y++)
      for (let x = 140; x < 222; x++) {
        const i = y * W + x;
        const lum = (0.2126 * C[i * 3] + 0.7152 * C[i * 3 + 1] + 0.0722 * C[i * 3 + 2]) / 255;
        nose0[i] = smooth(0.5, 0.3, lum) * (1 - smooth(316, 322, y));
      }
    layersFor.nose = nose0;
  } else nose0.set(everydayNose);
  let nose = nose0;
  if (season === 'christmas') {
    // The snow on top of the nose.
    nose = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) nose[y * W + x] = Math.max(...[0, 1, 2, 3, 4, 5, 6].map((k) => (y + k < H ? nose0[(y + k) * W + x] : 0)));
  }

  // Layers behind reach a little under the head, continuing their own colour
  // in the direction they go under it, so no gap opens when they move apart.
  const ext = (weight, dir, reach, from, flat) => {
    const colour = new Float32Array(N * 3);
    const alpha = new Float32Array(N);
    const [dx, dy] = dir;
    for (let i = 0; i < N; i++) {
      if (A[i] * weight[i] < 0.5) continue;
      const x = i % W, y = (i / W) | 0;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (A[n] * weight[n] >= 0.5 || head[n] < 0.5) continue;
      // The edge: copy a pixel a little inside it onwards under the head.
      const sx = x - dx * from, sy = y - dy * from;
      const s0 = sy * W + sx;
      const fill = flat ?? [F[s0 * 3], F[s0 * 3 + 1], F[s0 * 3 + 2]];
      for (let k = 1; k <= reach; k++) {
        const tx = x + dx * k, ty = y + dy * k;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) break;
        const t = ty * W + tx;
        if (head[t] < 0.5 || A[t] < 0.5) break;
        if (alpha[t] >= 1) continue;
        alpha[t] = 1;
        colour.set(fill, t * 3);
      }
    }
    return { colour, alpha };
  };
  const extensions = {
    antlers: ext(antlers, [0, 1], 10, 2, [74, 45, 39]),
    'ear-left': ext(earL, [1, 0], 10, 2),
    'ear-right': ext(earR, [-1, 0], 10, 2),
    neck: ext(neck, [0, -1], 16, 3),
  };

  const layers = {};
  const make = (name, weight, extension) => {
    const out = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const a = A[i] * Math.min(1, weight[i]);
      if (extension && extension.alpha[i] > 0 && a < 0.5) {
        out.set([extension.colour[i * 3], extension.colour[i * 3 + 1], extension.colour[i * 3 + 2], 1], i * 4);
        continue;
      }
      if (a <= 0.004) continue;
      out.set([F[i * 3], F[i * 3 + 1], F[i * 3 + 2], a], i * 4);
    }
    // Faint specks away from the layer's own shape (the edge of a neighbouring
    // part) would drift visibly once the layers part: drop them.
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

  // The face: the purple square without the deer (its gradient fitted, so no
  // trace of the deer is left), the Christmas snowflakes on it. The everyday
  // neck stays on it, so the deer rises out of the tile.
  const face = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const deer = A[i] > 0 || band[i] > 0;
    let [r0, g0, b0] = [B[i * 3], B[i * 3 + 1], B[i * 3 + 2]];
    let a0 = deer ? S[i] : Math.min(SA[i], S[i] > 0 ? 1 : 0);
    if (!deer && SA[i] > 0.5 && S[i] > 0.99) {
      // A snowflake: unmix it from the purple as white.
      const d = Math.hypot(C[i * 3] - r0, C[i * 3 + 1] - g0, C[i * 3 + 2] - b0);
      if (d > 12) {
        let num = 0, den = 0;
        for (let c = 0; c < 3; c++) {
          num += (C[i * 3 + c] - B[i * 3 + c]) * (255 - B[i * 3 + c]);
          den += (255 - B[i * 3 + c]) ** 2;
        }
        const w = Math.min(1, Math.max(0, num / den));
        r0 += (255 - r0) * w; g0 += (255 - g0) * w; b0 += (255 - b0) * w;
      }
    }
    // The neck, and its continuation under the head.
    let n = A[i] * neck[i], nc = [F[i * 3], F[i * 3 + 1], F[i * 3 + 2]];
    if (extensions.neck.alpha[i] > 0 && n < 0.5) {
      n = 1;
      nc = [extensions.neck.colour[i * 3], extensions.neck.colour[i * 3 + 1], extensions.neck.colour[i * 3 + 2]];
    }
    if (season === 'everyday' && n > 0) {
      const a = n + a0 * (1 - n);
      r0 = (nc[0] * n + r0 * a0 * (1 - n)) / a;
      g0 = (nc[1] * n + g0 * a0 * (1 - n)) / a;
      b0 = (nc[2] * n + b0 * a0 * (1 - n)) / a;
      a0 = a;
    }
    // Below the jaw the everyday face is the original artwork: the neck as
    // drawn, down to the square's edge.
    if (season === 'everyday' && neck[i] > 0) {
      const w = neck[i];
      const pa = SA[i];
      const a = a0 * (1 - w) + pa * w;
      if (a > 0) {
        r0 = (r0 * a0 * (1 - w) + C[i * 3] * pa * w) / a;
        g0 = (g0 * a0 * (1 - w) + C[i * 3 + 1] * pa * w) / a;
        b0 = (b0 * a0 * (1 - w) + C[i * 3 + 2] * pa * w) / a;
      }
      a0 = a;
    }
    face.set([r0, g0, b0, a0], i * 4);
  }
  layers.face = face;

  // The shade the deer casts on the face: its outline, softened and moved down.
  const sil = new Float32Array(N);
  for (let i = 0; i < N; i++) sil[i] = A[i] * Math.min(1, head[i] + antlers[i] + earL[i] + earR[i]);
  const silBuf = Buffer.from(Uint8Array.from(sil, (v) => Math.round(v * 255)));
  const blurred = await sharp(silBuf, { raw: { width: W, height: H, channels: 1 } }).blur(5).extractChannel(0).raw().toBuffer();
  if (blurred.length !== N) throw new Error('shade: unexpected channels');
  const shade = new Float32Array(N * 4);
  const DX = 2, DY = 6;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = x - DX, sy = y - DY;
      if (sx < 0 || sy < 0) continue;
      const v = blurred[sy * W + sx] / 255;
      const i = y * W + x;
      const a = 0.32 * v * (face[i * 4 + 3] > 0.5 ? 1 : face[i * 4 + 3]) * S[i];
      if (a < 0.004) continue;
      shade.set([40, 12, 78, a], i * 4);
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

  // Union box per layer, in frame units, on a 5-unit grid (so x0.8 and x1.6 are whole pixels).
  const names = ['face', 'shade', 'antlers', 'ear-left', 'ear-right', 'head', 'nose'];
  const boxes = {};
  for (const name of names) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const { layers, H } of results) {
      const L = layers[name];
      if (!L) continue;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (L[(y * W + x) * 4 + 3] > 0.004) {
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
          }
    }
    const H = Math.max(...results.map((r) => r.H));
    x0 = Math.max(0, Math.floor(x0 / 5) * 5); y0 = Math.max(0, Math.floor(y0 / 5) * 5);
    x1 = Math.min(W, Math.ceil(x1 / 5) * 5); y1 = Math.min(H + 3, Math.ceil(y1 / 5) * 5);
    boxes[name] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // Every season on the same canvas, so a layer has the same box in both.
  const HMAX = Math.max(...results.map((r) => r.H)) + 8;
  for (const { season, file, H, layers } of results) {
    for (const [name, L] of Object.entries(layers)) {
      const box = boxes[name];
      const padded = Buffer.alloc(W * HMAX * 4);
      toBuffer(L).copy(padded);
      const full = sharp(padded, { raw: { width: W, height: HMAX, channels: 4 } });
      const png = await full.png().toBuffer();
      for (const frame of name === 'shade' ? [144] : [288, 576]) {
        const k = frame / W;
        const scaled = await sharp(png).resize({ width: frame, height: Math.round(HMAX * k), kernel: 'mitchell' }).raw().toBuffer({ resolveWithObject: true });
        const h = Math.round(box.h * k);
        const out = path.join(OUT, `${file}-${name}-${frame}.webp`);
        // (The resized pixels are straight, not premultiplied, whatever the
        // info says: passing it on would divide the edges by their alpha again.)
        const res = await sharp(scaled.data, { raw: { width: scaled.info.width, height: scaled.info.height, channels: 4 } })
          .extract({ left: Math.round(box.x * k), top: Math.round(box.y * k), width: Math.round(box.w * k), height: h })
          .webp({ quality: name === 'shade' ? 70 : 84, alphaQuality: 100, effort: 6, smartSubsample: true })
          .toFile(out);
        console.log(path.basename(out), `${res.width}x${res.height}`, res.size, 'B');
      }
      if (DEBUG) await sharp(toBuffer(L), { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(DEBUG, `${season}-${name}.png`));
    }
  }
  console.log(JSON.stringify(boxes));
})();

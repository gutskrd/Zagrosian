/**
 * Weaves the rug's picture (rug-scene.ts) from its cells (rug.ts), once, into
 * pixels the GPU then shrinks smoothly (mipmaps), so it stays calm at any size
 * and angle.
 *
 * Each cell is two warps by two passes of weft, four small rounded pips of
 * wool, lighter on top and shaded between. The edges between the wools are a
 * little woolly rather than ruled; each strand is a shade lighter or darker,
 * and the dye drifts a little along the rug, as in wool dyed and woven by
 * hand. Beyond both ends the warp hangs out as a fringe, knotted where it
 * leaves the weave.
 */

/** Undyed ivory, black and natural grey wool, in sRGB. */
const WOOLS: [number, number, number][] = [
  [222, 216, 202],
  [27, 25, 24],
  [128, 122, 112],
];
const FRINGE_WOOL: [number, number, number] = [214, 207, 192];

/** A repeatable random number from 0 to 1 for a pair of whole numbers. */
const hash = (x: number, y: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const noise = (x: number, y: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

export interface WovenRug {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * The rug at `scale` pixels a cell, with `fringe` cells of fringe at either
 * end. Alpha is 0 between the fringe's threads. It is woven a band of rows at
 * a time, giving the page back its turn between bands, so it never holds up
 * scrolling or a tap.
 */
export async function weave(cells: string[], fringe: number, scale: number): Promise<WovenRug> {
  const columns = cells[0].length;
  const rows = cells.length;
  const width = columns * scale;
  const height = (rows + 2 * fringe) * scale;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const wool = (x: number, y: number) => {
    const cx = Math.min(columns - 1, Math.max(0, Math.floor(x)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(y)));
    const cell = cells[cy][cx];
    return cell === '#' ? 1 : cell === '+' ? 2 : 0;
  };

  let started = performance.now();
  for (let py = 0; py < height; py++) {
    if (performance.now() - started > 12) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      started = performance.now();
    }
    // In cells, from the top of the weave.
    const y = (py + 0.5) / scale - fringe;
    for (let px = 0; px < width; px++) {
      const x = (px + 0.5) / scale;
      const i = (py * width + px) * 4;

      if (y < 0 || y >= rows) {
        // The fringe: two threads to a cell, each a little wavy and of its own
        // length, knotted in bundles of four just outside the weave.
        const out = y < 0 ? -y : y - rows;
        const k = x * 2;
        const thread = Math.floor(k);
        const length = fringe * (0.72 + 0.28 * hash(thread, y < 0 ? 1 : 2));
        const across = k - thread - 0.5 + 0.08 * Math.sin(out * 1.7 + thread * 2.3);
        const knot = out < 0.9;
        const half = knot ? 0.5 : 0.3 - 0.05 * (out / fringe);
        const edge = 1.2 / scale;
        const cover =
          Math.min(1, Math.max(0, (half - Math.abs(across)) / edge + 0.5)) *
          Math.min(1, Math.max(0, (length - out) / edge + 0.5));
        const round = Math.sqrt(Math.max(0, 1 - (across / Math.max(half, 0.01)) ** 2));
        const shade = (0.72 + 0.28 * round) * (0.92 + 0.12 * hash(thread, 5)) * (knot ? 0.86 : 1);
        pixels[i] = FRINGE_WOOL[0] * shade;
        pixels[i + 1] = FRINGE_WOOL[1] * shade;
        pixels[i + 2] = FRINGE_WOOL[2] * shade;
        pixels[i + 3] = cover * 255;
        continue;
      }

      // Which wool, read from a slightly shaken point: woolly edges.
      const jx = (noise(x * 3.1, y * 3.1) - 0.5) * 0.3;
      const jy = (noise(x * 3.1 + 17.3, y * 3.1 + 5.1) - 0.5) * 0.3;
      const colour = WOOLS[wool(x + jx, y + jy)];

      // The pips: two passes a cell, each over every other warp, offset from
      // the pass before.
      const pass = Math.floor(y * 2);
      const pu = x * 2 + 0.5 * (pass & 1);
      const u = pu - Math.floor(pu);
      const v = y * 2 - pass;
      const pip = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      const strand = hash(Math.floor(pu), pass);
      const dye = noise(x * 0.08, y * 0.05) * 0.6 + noise(3.7, y * 0.35) * 0.4;
      const shade = (0.8 + 0.22 * Math.sqrt(pip)) * (0.95 + 0.08 * (strand - 0.5)) * (0.95 + 0.08 * dye);
      pixels[i] = colour[0] * shade;
      pixels[i + 1] = colour[1] * shade;
      pixels[i + 2] = colour[2] * shade;
      pixels[i + 3] = 255;
    }
  }
  return { pixels, width, height };
}

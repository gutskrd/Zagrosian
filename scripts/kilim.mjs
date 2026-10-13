// Draws the site's kilim, cell by cell, as a weaver would on a loom, and
// saves it in src/assets/kilim/:
//
// - rug.ts: the rug (About.astro), 101 by 161 cells in three wools: undyed
//   ivory, black, and a natural grey. The 3D rug (rug-scene.ts) weaves its
//   texture from these cells.
// - rug-ink.svg and rug-grey.svg: the same rug as two masks, one for each
//   dyed wool, for the flat picture shown where there is no 3D.
// - band.svg: one repeat of a woven band (Footer.astro): a medallion and a
//   pair of ram's horns between two chain borders, tiled across the page, in
//   one colour, which the page paints in its own ink.
//
// The rug is laid out as Kurdish kilims from the Zagros are, symmetrical about
// both its axes: a selvedge, a chain guard, a main border of small diamonds
// and pairs of ram's horns with an eight-pointed star in each corner, an inner
// guard of dots, then the field: a tall hooked medallion in bands, with a star
// at its heart and a pendant on a stem at either end, quarter medallions in
// the corners, and eyes and ram's horns in the open ground. The hooked
// diamond, the ram's horn (strength) and the eye (protection) are old motifs
// of the region; this drawing of them is our own.
//
// Usage: node scripts/kilim.mjs
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/assets/kilim/', import.meta.url));

const IVORY = 0;
const INK = 1;
const GREY = 2;

/**
 * A motif from a picture of it: `#` is black, `+` grey, `o` ivory, and
 * anything else leaves what is under it.
 */
const motif = (picture) =>
  picture
    .trim()
    .split('\n')
    .map((line) => [...line.trim()].map((cell) => ({ '#': INK, '+': GREY, o: IVORY })[cell] ?? -1));

const flipX = (picture) => picture.map((row) => [...row].reverse());
const flipY = (picture) => [...picture].reverse();
/** Turned a quarter, so a motif standing up lies along a row. */
const turn = (picture) => picture[0].map((_, i) => picture.map((row) => row[i]).reverse());
/** The same motif in other wools: `{ from: to }`. */
const recolour = (picture, map) => picture.map((row) => row.map((cell) => (cell in map ? map[cell] : cell)));

const horns = motif(`
  #...#
  #...#
  ##.##
  .###.
  ..#..
`);

const eye = motif(`
  ..#..
  .#+#.
  #+#+#
  .#+#.
  ..#..
`);

const star = motif(`
  ....#....
  ...###...
  #..#+#..#
  .##+++##.
  ##+++++##
  .##+++##.
  #..#+#..#
  ...###...
  ....#....
`);

/** A pair of ram's horns, one above the other. */
const hornPair = motif(`
  #...#
  ##.##
  .###.
  ..#..
  .###.
  ##.##
  #...#
`);

class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: height }, () => Array(width).fill(IVORY));
  }

  set(x, y, wool = INK) {
    if (wool >= 0 && x >= 0 && y >= 0 && x < this.width && y < this.height) this.cells[y][x] = wool;
  }

  stamp(picture, left, top, { flip = false } = {}) {
    picture.forEach((row, y) => row.forEach((wool, x) => wool > 0 && this.set(left + x, top + (flip ? picture.length - 1 - y : y), wool)));
  }

  /** A motif placed by its centre. */
  centred(picture, x, y) {
    const left = x - (picture[0].length >> 1);
    const top = y - (picture.length >> 1);
    picture.forEach((row, dy) => row.forEach((wool, dx) => this.set(left + dx, top + dy, wool)));
  }

  /** A motif placed by its centre at (dx, dy) from the middle, and mirrored into the other three quarters. */
  mirrored(picture, dx, dy) {
    const cx = this.width >> 1;
    const cy = this.height >> 1;
    this.centred(picture, cx + dx, cy + dy);
    this.centred(flipX(picture), cx - dx, cy + dy);
    this.centred(flipY(picture), cx + dx, cy - dy);
    this.centred(flipX(flipY(picture)), cx - dx, cy - dy);
  }

  /** A rectangle's outline, `inset` cells in from the edge. */
  frame(inset) {
    for (let x = inset; x < this.width - inset; x++) {
      this.set(x, inset);
      this.set(x, this.height - 1 - inset);
    }
    for (let y = inset; y < this.height - inset; y++) {
      this.set(inset, y);
      this.set(this.width - 1 - inset, y);
    }
  }

  /** A chain of small diamonds, three cells wide, along a row or a column. */
  chain(along, at, from, to) {
    for (let i = from; i <= to; i++) {
      const link = (i - from) % 4 === 2;
      const [a, b, c] = [at, at + 1, at + 2];
      if (along === 'row') link ? (this.set(i, a), this.set(i, c)) : this.set(i, b);
      else link ? (this.set(a, i), this.set(c, i)) : this.set(b, i);
    }
  }

  /**
   * A hooked diamond of the given radius around (cx, cy): a stepped outline
   * two cells thick with hooks along its outer edges, two rings inside it
   * (for a radius over 7) and a heart. In black, for the band.
   */
  medallion(cx, cy, radius) {
    for (let y = cy - radius - 1; y <= cy + radius + 1; y++) {
      for (let x = cx - radius - 1; x <= cx + radius + 1; x++) {
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        const d = dx + dy;
        const ring = d === radius || d === radius - 1 || d === radius - 4 || (radius > 7 && d === radius - 7) || d === 0;
        const hook = d === radius + 1 && dx % 2 === 1 && dx > 1 && dy > 1;
        if (ring || hook) this.set(x, y);
      }
    }
  }

  /**
   * A diamond in bands around (x0, y0), `rx` cells to its side points and
   * taller by 1 / `ky`. `bands` lists, from the outside in, each band's wool
   * and thickness; the last fills the middle. With `hooks`, latch hooks of
   * that wool stand out from the outline every third step. Only cells where
   * `inside` holds are woven.
   */
  diamond(x0, y0, rx, ky, bands, { hooks = -1, inside = () => true } = {}) {
    const ry = Math.ceil(rx / ky) + 2;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx - 2; x <= rx + 2; x++) {
        if (!inside(x0 + x, y0 + y)) continue;
        const d = Math.abs(x) + Math.floor(Math.abs(y) * ky);
        let depth = rx - d;
        let wool = -1;
        if (depth >= 0) {
          wool = bands[bands.length - 1][0];
          for (const [band, thickness] of bands) {
            if (depth < thickness) {
              wool = band;
              break;
            }
            depth -= thickness;
          }
        } else if (hooks >= 0 && d === rx + 1 && Math.abs(x) % 3 === 1 && Math.abs(x) > 1 && Math.abs(y) > 1) {
          wool = hooks;
        }
        this.set(x0 + x, y0 + y, wool);
      }
    }
  }

  /** The grid as text, a row a line: `#` black, `+` grey, `.` ivory. */
  rows() {
    return this.cells.map((row) => row.map((wool) => '.#+'[wool]).join(''));
  }

  /** The cells of one wool as SVG: each run of them in a row is one rectangle. */
  svg(wool = INK) {
    const runs = [];
    this.cells.forEach((row, y) => {
      for (let x = 0; x < this.width; ) {
        if (row[x] !== wool) {
          x++;
          continue;
        }
        let end = x;
        while (end < this.width && row[end] === wool) end++;
        runs.push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
        x = end;
      }
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" width="${this.width}" height="${this.height}" shape-rendering="crispEdges"><path d="${runs.join('')}"/></svg>\n`;
  }
}

function rug() {
  const grid = new Grid(101, 161);
  const { width, height } = grid;
  const cx = width >> 1;
  const cy = height >> 1;

  // The frame, by depth from the edge: selvedge, chain guard, a grey line, the
  // main border (black, 8 to 16), a grey line, a guard of grey dots, a black
  // line, and the field from 24 in.
  const border = [8, 16];
  const middle = 12;
  const field = 24;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ex = Math.min(x, width - 1 - x);
      const ey = Math.min(y, height - 1 - y);
      const e = Math.min(ex, ey);
      // Along each side from its middle, so both halves match.
      const along = ex < ey ? y - cy : x - cx;
      const step = (n) => ((along % n) + n) % n;
      let wool = IVORY;
      if (e <= 1) wool = INK;
      else if (e >= 3 && e <= 5) wool = (e === 4) === (step(4) !== 2) ? INK : IVORY;
      else if (e === 7 || e === 17) wool = GREY;
      else if (e >= border[0] && e <= border[1]) wool = INK;
      else if (e >= 19 && e <= 21) wool = (e === 20 ? step(6) === 0 : step(6) === 2 || step(6) === 4) ? GREY : IVORY;
      else if (e === 23) wool = INK;
      grid.set(x, y, wool);
    }
  }

  // The main border: small diamonds and pairs of ram's horns, every 12 cells
  // from the middle of each side, and a star in each corner.
  const inBorder = (x, y) => {
    const e = Math.min(x, width - 1 - x, y, height - 1 - y);
    return e >= border[0] && e <= border[1];
  };
  const every = 12;
  const hornsAlong = recolour(turn(hornPair), { [INK]: GREY });
  const hornsDown = recolour(hornPair, { [INK]: GREY });
  for (let k = -12; k <= 12; k++) {
    for (const along of ['x', 'y']) {
      const centre = along === 'x' ? cx : cy;
      const last = (along === 'x' ? width : height) - 1 - border[1] - 5;
      const at = centre + k * every;
      const sides = (p) => (along === 'x' ? [[p, middle], [p, height - 1 - middle]] : [[middle, p], [width - 1 - middle, p]]);
      if (at >= border[1] + 5 && at <= last) {
        for (const [x, y] of sides(at)) grid.diamond(x, y, 3, 1, [[IVORY, 1], [GREY, 1], [INK, 1], [IVORY, 1]], { inside: inBorder });
      }
      const between = at + every / 2;
      if (between >= border[1] + 5 && between <= last) {
        for (const [x, y] of sides(between)) grid.centred(along === 'x' ? hornsAlong : hornsDown, x, y);
      }
    }
  }
  const cornerStar = recolour(star, { [INK]: IVORY });
  for (const [x, y] of [[middle, middle], [width - 1 - middle, middle], [middle, height - 1 - middle], [width - 1 - middle, height - 1 - middle]]) {
    grid.centred(cornerStar, x, y);
  }

  // The field: quarter medallions in its corners...
  const half = [cx - field, cy - field];
  const inField = (x, y) => Math.abs(x - cx) <= half[0] && Math.abs(y - cy) <= half[1];
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    grid.diamond(cx + sx * (half[0] + 1), cy + sy * (half[1] + 1), 14, 0.62, [[INK, 2], [IVORY, 1], [GREY, 3], [IVORY, 1], [INK, 9]], {
      hooks: INK,
      inside: inField,
    });
  }
  // ...the medallion, in bands, with a lattice of dots in its ivory band and a
  // star at its heart...
  grid.diamond(cx, cy, 22, 0.48, [[INK, 2], [IVORY, 1], [GREY, 3], [IVORY, 1], [INK, 1], [IVORY, 5], [INK, 2], [GREY, 9]], { hooks: INK });
  for (let dy = 0; dy <= 46; dy++) {
    for (let dx = 0; dx <= 22; dx++) {
      const d = dx + Math.floor(dy * 0.48);
      if (d >= 9 && d <= 13 && (dx + dy) % 4 === 0 && (dx - dy + 100) % 4 === 0) {
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) grid.set(cx + sx * dx, cy + sy * dy, INK);
      }
    }
  }
  grid.centred(recolour(star, { [INK]: IVORY, [GREY]: INK }), cx, cy);
  // ...a pendant on a stem at either end...
  for (const s of [-1, 1]) {
    grid.diamond(cx, cy + s * 49, 5, 0.9, [[INK, 2], [GREY, 2], [INK, 2]]);
    for (let i = 0; i < 3; i++) grid.set(cx, cy + s * (46 - i), INK);
  }
  // ...and eyes and ram's horns in the open ground.
  grid.mirrored(eye, 17, 4);
  grid.mirrored(eye, 13, 26);
  grid.mirrored(flipY(horns), 20, 18);
  grid.mirrored(eye, 7, 44);
  grid.mirrored(horns, 18, 34);
  return grid;
}

// One repeat of the band: 24 by 31 cells. A bar, the chain, then a medallion
// and a pair of horns, the chain again and a bar.
function band() {
  const grid = new Grid(24, 31);
  const { width, height } = grid;
  for (const y of [0, 1, height - 2, height - 1]) for (let x = 0; x < width; x++) grid.set(x, y);
  grid.chain('row', 3, 0, width - 1);
  grid.chain('row', height - 6, 0, width - 1);
  grid.medallion(8, 15, 7);
  grid.stamp(
    [...horns, [-1, -1, INK, -1, -1], ...flipY(horns)].map((row) => row.map((wool) => (wool === INK ? INK : -1))),
    18,
    15 - 5,
  );
  return grid;
}

mkdirSync(OUT, { recursive: true });
const theRug = rug();
writeFileSync(`${OUT}rug-ink.svg`, theRug.svg(INK));
writeFileSync(`${OUT}rug-grey.svg`, theRug.svg(GREY));
writeFileSync(`${OUT}band.svg`, band().svg());
writeFileSync(
  `${OUT}rug.ts`,
  `// Drawn by scripts/kilim.mjs; edit that and run it again. The rug's cells,\n` +
    `// row by row from the top: # black wool, + grey, . ivory.\n` +
    `export const rugCells = [\n${theRug.rows().map((row) => `  '${row}',`).join('\n')}\n];\n`,
);
try {
  unlinkSync(`${OUT}rug.svg`);
} catch {
  // Already gone.
}
console.log('Wrote rug.ts, rug-ink.svg, rug-grey.svg and band.svg to src/assets/kilim/');

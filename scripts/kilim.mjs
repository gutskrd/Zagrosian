// Draws the woven band across the top of the footer (Footer.astro), cell by
// cell as a weaver would on a loom, and saves one repeat of it as
// src/assets/kilim/band.svg: a hooked diamond and a pair of ram's horns
// between two chain borders, 24 by 31 cells, in one colour, which the page
// paints in its own ink. The hooked diamond and the ram's horn are old motifs
// of Kurdish kilims from the Zagros; this drawing of them is our own.
//
// Usage: node scripts/kilim.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
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

const flipY = (picture) => [...picture].reverse();

const horns = motif(`
  #...#
  #...#
  ##.##
  .###.
  ..#..
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
writeFileSync(`${OUT}band.svg`, band().svg());
console.log('Wrote band.svg to src/assets/kilim/');

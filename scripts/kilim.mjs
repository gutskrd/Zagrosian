// Draws the site's kilim, cell by cell, as a weaver would on a loom, and
// saves it as two SVG files in src/assets/kilim/:
//
// - rug.svg: a small rug (About.astro): three hooked medallions stacked down
//   the middle, ram's horns at their sides, eyes in the open ground around
//   them, inside a chain border.
// - band.svg: one repeat of a woven band (Footer.astro): a medallion and a
//   pair of ram's horns between two chain borders, tiled across the page.
// - rug.ts: the rug's cells as text, which the 3D rug (rug-scene.ts) weaves
//   from.
//
// The motifs are those of Kurdish kilims from the Zagros: the hooked diamond,
// the ram's horn (strength) and the eye (protection), on a grid of square
// cells as a flat weave is, in one colour on the ground. The pattern is our
// own drawing of them. The files are masks: the page paints them in its own
// ink, so they follow the theme.
//
// Usage: node scripts/kilim.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/assets/kilim/', import.meta.url));

/** A motif from a picture of it: `#` is woven, anything else is ground. */
const motif = (picture) =>
  picture
    .trim()
    .split('\n')
    .map((line) => [...line.trim()].map((cell) => cell === '#'));

const horns = motif(`
  #...#
  #...#
  ##.##
  .###.
  ..#..
`);

const eye = motif(`
  ..#..
  .#.#.
  #.#.#
  .#.#.
  ..#..
`);

/** A pair of ram's horns, one above the other, for the band. */
const hornPair = [...horns, [false, false, true, false, false], ...[...horns].reverse()];

class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: height }, () => Array(width).fill(false));
  }

  set(x, y) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.cells[y][x] = true;
  }

  stamp(picture, left, top, { flip = false } = {}) {
    picture.forEach((row, y) =>
      row.forEach((woven, x) => woven && this.set(left + x, top + (flip ? picture.length - 1 - y : y))),
    );
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
   * (for a radius over 7) and a heart.
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

  /** The grid as text, a row a line: `#` woven, `.` ground. */
  rows() {
    return this.cells.map((row) => row.map((woven) => (woven ? '#' : '.')).join(''));
  }

  /** The grid as SVG: each run of woven cells in a row is one rectangle. */
  svg() {
    const runs = [];
    this.cells.forEach((row, y) => {
      for (let x = 0; x < this.width; ) {
        if (!row[x]) {
          x++;
          continue;
        }
        let end = x;
        while (end < this.width && row[end]) end++;
        runs.push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
        x = end;
      }
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" width="${this.width}" height="${this.height}" shape-rendering="crispEdges"><path d="${runs.join('')}"/></svg>\n`;
  }
}

// The rug: 47 by 77 cells. A selvedge, the chain border, a line, then the
// field: three medallions tip to tip, ram's horns off their side points, eyes
// where they meet and in the field's corners.
function rug() {
  const grid = new Grid(47, 77);
  const { width, height } = grid;
  grid.frame(0);
  grid.chain('row', 2, 2, width - 3);
  grid.chain('row', height - 5, 2, width - 3);
  grid.chain('column', 2, 2, height - 3);
  grid.chain('column', width - 5, 2, height - 3);
  grid.frame(6);
  const cx = 23;
  const cy = 38;
  const radius = 10;
  for (const y of [cy - 2 * radius, cy, cy + 2 * radius]) {
    grid.medallion(cx, y, radius);
    grid.stamp(horns, 10, y - 2);
    grid.stamp(horns, width - 15, y - 2);
  }
  for (const y of [cy - radius, cy + radius]) {
    grid.stamp(eye, 10, y - 2);
    grid.stamp(eye, width - 15, y - 2);
  }
  for (const [x, y] of [[10, 10], [width - 15, 10], [10, height - 15], [width - 15, height - 15]]) grid.stamp(eye, x, y);
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
  grid.stamp(hornPair, 18, 15 - 5);
  return grid;
}

mkdirSync(OUT, { recursive: true });
const theRug = rug();
writeFileSync(`${OUT}rug.svg`, theRug.svg());
writeFileSync(`${OUT}band.svg`, band().svg());
writeFileSync(
  `${OUT}rug.ts`,
  `// Drawn by scripts/kilim.mjs; edit that and run it again. The rug's cells,\n` +
    `// row by row from the top: # woven in ink, . the ground.\n` +
    `export const rugCells = [\n${theRug.rows().map((row) => `  '${row}',`).join('\n')}\n];\n`,
);
console.log('Wrote rug.svg, band.svg and rug.ts to src/assets/kilim/');

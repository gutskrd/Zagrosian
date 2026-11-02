/**
 * A paper plane, folded from a sheet as one is by hand, so that it can be
 * unfolded along its real creases (plane.ts), and so the sheet it opens into
 * shows the same creases (Proverb.astro).
 *
 * The sheet is one wide and √2 long (A4's proportions), x across from -0.5
 * to 0.5 and y from 0 at the nose to √2. The classic dart:
 *
 * 1. Both top corners folded to the centre line.
 * 2. Both new edges folded to the centre line again.
 * 3. Folded in half along the centre (the spine), the halves rising.
 * 4. Each wing folded back down, from the nose to the tail.
 *
 * The creases cut the sheet into pieces that stay flat; each piece is moved
 * by the folds it lies on the moving side of. With every fold at its full
 * angle it is a plane; with every fold at zero, the flat sheet. No DOM here:
 * this is also read when the page is built.
 */

export type Point = [number, number];

/** A 2D map that keeps shapes (reflections and turns): x' = a x + c y + e, y' = b x + d y + f. */
type Affine = [number, number, number, number, number, number];

export const LENGTH = Math.SQRT2;
/** Where the second fold's crease meets the side: it halves the 45° at the nose. */
const EDGE = 0.5 / Math.tan(Math.PI / 8);
/** How far from the spine, at the tail, the wings are folded: the keel's depth. */
const KEEL = 0.12;

export interface Fold {
  /** The crease, in the sheet as it lies when this fold is made. */
  from: Point;
  to: Point;
  /** A point on the side that moves. */
  side: Point;
  /** Folded flat (a half turn), or into the air as a plane's spine and wings are. */
  flat: boolean;
  /** 1: the moving side rises over the side that stays; -1: it goes the other way (the wings). */
  towards: 1 | -1;
  /** The fold whose turn carries this crease with it (a wing's crease, by its half of the spine). */
  carriedBy?: number;
}

export const folds: Fold[] = [
  { from: [0, 0], to: [-0.5, 0.5], side: [-0.45, 0.02], flat: true, towards: 1 },
  { from: [0, 0], to: [0.5, 0.5], side: [0.45, 0.02], flat: true, towards: 1 },
  { from: [0, 0], to: [-0.5, EDGE], side: [-0.45, 0.8], flat: true, towards: 1 },
  { from: [0, 0], to: [0.5, EDGE], side: [0.45, 0.8], flat: true, towards: 1 },
  { from: [0, 0], to: [0, LENGTH], side: [-0.3, 1], flat: false, towards: 1 },
  { from: [0, 0], to: [0, LENGTH], side: [0.3, 1], flat: false, towards: 1 },
  { from: [0, 0], to: [-KEEL, LENGTH], side: [-0.35, 1.3], flat: false, towards: -1, carriedBy: 4 },
  { from: [0, 0], to: [KEEL, LENGTH], side: [0.35, 1.3], flat: false, towards: -1, carriedBy: 5 },
];

export interface Piece {
  /** Its outline in the flat sheet. */
  outline: Point[];
  /** Which folds move it. */
  moves: boolean[];
  /** Its place in the stack once folded flat: 0 is the sheet at the bottom. */
  layer: number;
  /** How many times it has been turned over: its stack offset goes the other way each time. */
  flips: number;
}

export interface Crease {
  from: Point;
  to: Point;
}

const apply = ([a, b, c, d, e, f]: Affine, [x, y]: Point): Point => [a * x + c * y + e, b * x + d * y + f];

const compose = ([a1, b1, c1, d1, e1, f1]: Affine, [a2, b2, c2, d2, e2, f2]: Affine): Affine => [
  a1 * a2 + c1 * b2,
  b1 * a2 + d1 * b2,
  a1 * c2 + c1 * d2,
  b1 * c2 + d1 * d2,
  a1 * e2 + c1 * f2 + e1,
  b1 * e2 + d1 * f2 + f1,
];

const invert = ([a, b, c, d, e, f]: Affine): Affine => {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
};

/** The mirror image across the line through p and q. */
const reflection = ([px, py]: Point, [qx, qy]: Point): Affine => {
  const length = Math.hypot(qx - px, qy - py);
  const ux = (qx - px) / length;
  const uy = (qy - py) / length;
  const a = 2 * ux * ux - 1;
  const b = 2 * ux * uy;
  const d = 2 * uy * uy - 1;
  return [a, b, b, d, px - a * px - b * py, py - b * px - d * py];
};

/** Which side of the line from p to q a point is on, and how far, times the line's length. */
const sideOf = ([px, py]: Point, [qx, qy]: Point, [x, y]: Point) => (qx - px) * (y - py) - (qy - py) * (x - px);

const area = (outline: Point[]) =>
  Math.abs(outline.reduce((sum, [x, y], i) => {
    const [nx, ny] = outline[(i + 1) % outline.length];
    return sum + x * ny - nx * y;
  }, 0)) / 2;

const centroid = (outline: Point[]): Point => [
  outline.reduce((s, p) => s + p[0], 0) / outline.length,
  outline.reduce((s, p) => s + p[1], 0) / outline.length,
];

/** Without points that repeat the one before (every crease passes through the nose). */
const tidy = (outline: Point[]) =>
  outline.filter((point, i) => {
    const before = outline[(i + outline.length - 1) % outline.length];
    return Math.hypot(point[0] - before[0], point[1] - before[1]) > 1e-9;
  });

/** The part of a polygon on one side of a line (sign 1 or -1). */
const clip = (outline: Point[], p: Point, q: Point, sign: number): Point[] => tidy(cut(outline, p, q, sign));

const cut = (outline: Point[], p: Point, q: Point, sign: number): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const sa = sideOf(p, q, a) * sign;
    const sb = sideOf(p, q, b) * sign;
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
};

/** Folds the sheet: its pieces, and its creases, in the flat sheet. */
export function foldSheet(): { pieces: Piece[]; creases: Crease[] } {
  type Working = Piece & { layout: Affine };
  let pieces: Working[] = [
    {
      outline: [
        [-0.5, 0],
        [0.5, 0],
        [0.5, LENGTH],
        [-0.5, LENGTH],
      ],
      layout: [1, 0, 0, 1, 0, 0],
      moves: [],
      layer: 0,
      flips: 0,
    },
  ];
  const creases: Crease[] = [];

  folds.forEach((fold, index) => {
    const moving = Math.sign(sideOf(fold.from, fold.to, fold.side));
    const next: Working[] = [];
    for (const piece of pieces) {
      const laid = piece.outline.map((point) => apply(piece.layout, point));
      const back = invert(piece.layout);
      const parts = [clip(laid, fold.from, fold.to, 1), clip(laid, fold.from, fold.to, -1)].filter((part) => part.length >= 3 && area(part) > 1e-7);
      if (parts.length === 2) {
        // Cut by the crease: where it crosses the piece is a crease of the sheet.
        const on = parts[0].filter((point) => Math.abs(sideOf(fold.from, fold.to, point)) < 1e-9);
        if (on.length >= 2) creases.push({ from: apply(back, on[0]), to: apply(back, on[on.length - 1]) });
      }
      for (const part of parts) {
        const moves = Math.sign(sideOf(fold.from, fold.to, centroid(part))) === moving;
        next.push({ ...piece, outline: part.map((point) => apply(back, point)), moves: [...piece.moves, moves] });
      }
    }
    if (fold.flat) {
      // The moving pieces are turned over onto the rest, their stack upside down.
      const top = Math.max(...next.map((piece) => piece.layer));
      const movedTop = Math.max(...next.filter((piece) => piece.moves[index]).map((piece) => piece.layer));
      const mirror = reflection(fold.from, fold.to);
      for (const piece of next) {
        if (!piece.moves[index]) continue;
        piece.layer = top + 1 + (movedTop - piece.layer);
        piece.flips += 1;
        piece.layout = compose(mirror, piece.layout);
      }
    }
    pieces = next;
  });

  return {
    pieces: pieces.map(({ outline, moves, layer, flips }) => ({ outline, moves, layer, flips })),
    creases,
  };
}

/** Each fold's full angle, in radians: half turns for the flat folds, and the plane's spine and wings. */
export const FOLDED = [Math.PI, Math.PI, Math.PI, Math.PI, 1.47, 1.47, 1.4, 1.4];

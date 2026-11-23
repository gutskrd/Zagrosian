/**
 * Folding geometry for the paper plane: the sheet is folded along real creases so plane.ts can
 * unfold it, and so the proverb sheet (Proverb.astro) shows the same creases.
 *
 * The sheet is 1 wide and sqrt(2) long (A4 proportions): x from -0.5 to 0.5, y from 0 at the nose
 * to sqrt(2). The classic dart:
 *
 * 1. Fold both top corners to the center line.
 * 2. Fold both new edges to the center line again.
 * 3. Fold in half along the center (the spine), halves rising.
 * 4. Fold each wing back down, from nose to tail.
 *
 * The creases cut the sheet into rigid pieces; each piece is moved by every fold it lies on the
 * moving side of. All folds at full angle give the plane, all at zero the flat sheet. DOM-free, so
 * it can also run at build time.
 */

export type Point = [number, number];

/** 2D affine transform (rotations and reflections): x' = a*x + c*y + e, y' = b*x + d*y + f. */
type Affine = [number, number, number, number, number, number];

export const LENGTH = Math.SQRT2;
/** Where the second fold's crease meets the edge: it bisects the 45-degree nose angle. */
const EDGE = 0.5 / Math.tan(Math.PI / 8);
/** Wing fold offset from the spine at the tail: the keel depth. */
const KEEL = 0.12;

export interface Fold {
  /** The crease, in the sheet as it lies when this fold is made. */
  from: Point;
  to: Point;
  /** A point on the moving side. */
  side: Point;
  /** Folded flat (a half turn), or into the air like the spine and wings. */
  flat: boolean;
  /** 1: the moving side folds over the static side; -1: under it (the wings). */
  towards: 1 | -1;
  /**
   * Fold whose rotation carries this crease (a wing's crease, carried by its half of the spine).
   */
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
  /** Outline in the flat sheet. */
  outline: Point[];
  /** Which folds move this piece. */
  moves: boolean[];
  /** Stack position once folded flat: 0 is the bottom layer. */
  layer: number;
  /** Number of times the piece has been flipped; each flip reverses its stack offset. */
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

/** Reflection across the line through p and q. */
const reflection = ([px, py]: Point, [qx, qy]: Point): Affine => {
  const length = Math.hypot(qx - px, qy - py);
  const ux = (qx - px) / length;
  const uy = (qy - py) / length;
  const a = 2 * ux * ux - 1;
  const b = 2 * ux * uy;
  const d = 2 * uy * uy - 1;
  return [a, b, b, d, px - a * px - b * py, py - b * px - d * py];
};

/** Signed side of point relative to the line p->q, scaled by the line's length. */
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

/** Removes consecutive duplicate points (every crease passes through the nose). */
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

/** Folds the sheet. Returns its pieces and creases, in flat-sheet coordinates. */
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
        // Where the crease cuts the piece is a crease of the sheet.
        const on = parts[0].filter((point) => Math.abs(sideOf(fold.from, fold.to, point)) < 1e-9);
        if (on.length >= 2) creases.push({ from: apply(back, on[0]), to: apply(back, on[on.length - 1]) });
      }
      for (const part of parts) {
        const moves = Math.sign(sideOf(fold.from, fold.to, centroid(part))) === moving;
        next.push({ ...piece, outline: part.map((point) => apply(back, point)), moves: [...piece.moves, moves] });
      }
    }
    if (fold.flat) {
      // Moving pieces flip over onto the rest, with their stack order reversed.
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

/** Full angle of each fold, in radians: half turns for the flat folds, then the spine and wings. */
export const FOLDED = [Math.PI, Math.PI, Math.PI, Math.PI, 1.47, 1.47, 1.4, 1.4];

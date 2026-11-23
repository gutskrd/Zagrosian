/**
 * Paper plane hidden under the rug (Rug.astro), revealed once the rug has been lifted (button or by
 * hand). Until then the proverb sheet (Proverb.astro) stays static. After that, scrolling flies the
 * plane out from under the corner, opens its wings and glides it down the page; once the sheet is
 * fully visible the plane lands on it and unfolds into it, on a timer, so the sheet is readable
 * wherever scrolling stops. Scrolling back reverses the flight.
 *
 * Rendering: the plane is folded from a flat sheet (plane-folds.ts) and drawn on a 2D canvas. Each
 * frame its polygons are transformed in 3D, projected from the viewer's eye (matching CSS
 * perspective), flat-shaded by their orientation to the light, and painted back to front: a few
 * dozen polygons, cheap even on slow phones, with no GPU state. The ground shadow (an airliner
 * silhouette) is pre-rendered once and stamped. At rest under the rug the plane is drawn once onto
 * a canvas inside the rug's stage, so it scrolls with the rug and sits under the rug's own shadow;
 * in flight it is drawn on a fixed full-viewport canvas, first under the rug, then over the page
 * and below the header.
 *
 * The proverb is real text throughout and is always exposed to screen readers; it is only visually
 * hidden while the plane carries it. With reduced motion the plane stays put and the sheet is
 * static.
 */
import { pixelRatio } from '../utils/device';
import { clamp, mix, smoothstep } from '../utils/math';
import { FOLDED, LENGTH, folds, foldSheet, type Piece } from './plane-folds';

type Matrix = Float64Array;
type Vector = [number, number, number];

/** Separation between paper layers, in sheet units, to avoid z-fighting. */
const LAYER = 0.0025;
/** Eye distance in px, as in CSS `perspective`. */
const PERSPECTIVE = 1500;
/** Light direction: upper left and in front, matching the rug. */
const LIGHT: Vector = normalize([-0.42, -0.55, 0.72]);
/** Paper color of the sheet (Proverb.astro); flat and facing up, the plane matches it exactly. */
const PAPER: Vector = [243, 239, 230];

// Scroll progress: 0 with the rug centered in the viewport, 1 with the sheet fully visible.
/** Fully out from under the rug. */
const OUT = 0.14;
/** Wings open, airborne. */
const AIRBORNE = 0.26;
/** Landing and unfolding duration once the sheet is visible, in seconds. */
const LANDING = 1.5;

/**
 * Airliner silhouette for the shadow, top view, nose right, in a 200-unit square: fuselage, wings,
 * tailplane, engines.
 */
const AIRLINER = [
  'M8 100C8 95 20 93.5 40 93.5H168C182 93.5 194 97 197 100C194 103 182 106.5 168 106.5H40C20 106.5 8 105 8 100Z',
  'M120 94 74 12H61L84 94Z',
  'M120 106 74 188H61L84 106Z',
  'M35 94 15 63H7L20 94Z',
  'M35 106 15 137H7L20 106Z',
];
const ENGINES = [
  [104, 66, 10, 3.6],
  [104, 134, 10, 3.6],
  [88, 38, 8, 3],
  [88, 162, 8, 3],
];

/** Signed shortest angle from `a` to `b`. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function normalize([x, y, z]: Vector): Vector {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

const identity = (): Matrix => {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
};

/** Composes two column-major matrices: `a`, then `b`. */
const multiply = (b: Matrix, a: Matrix): Matrix => {
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += b[k * 4 + r] * a[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
};

const translation = (x: number, y: number, z: number): Matrix => {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
};

const scaling = (s: number): Matrix => {
  const m = identity();
  m[0] = m[5] = m[10] = s;
  return m;
};

/** Right-handed rotation by `angle` about the axis through `point` along the unit vector `axis`. */
const rotation = (point: Vector, [x, y, z]: Vector, angle: number): Matrix => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  const r = identity();
  r[0] = t * x * x + c;
  r[1] = t * x * y + s * z;
  r[2] = t * x * z - s * y;
  r[4] = t * x * y - s * z;
  r[5] = t * y * y + c;
  r[6] = t * y * z + s * x;
  r[8] = t * x * z + s * y;
  r[9] = t * y * z - s * x;
  r[10] = t * z * z + c;
  return multiply(translation(point[0], point[1], point[2]), multiply(r, translation(-point[0], -point[1], -point[2])));
};

const transform = (m: Matrix, [x, y, z]: Vector): Vector => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** Plane pose: page position in px, height above the page, and orientation. */
interface Pose {
  x: number;
  y: number;
  z: number;
  /** Nose direction on the page, in radians clockwise from the +x axis. */
  heading: number;
  /** Nose-down pitch toward the page. */
  pitch: number;
  /** Roll about the longitudinal axis. */
  bank: number;
  /** Sheet width in px. */
  scale: number;
}

/** Current angle of each fold, from 0 (open) to its folded angle (FOLDED). */
type Angles = number[];

interface Moment {
  pose: Pose;
  angles: Angles;
  /** Shadow opacity, 0 to 1. */
  shadow: number;
}

/** Body transform: the spine's midpoint at the pose position, nose along the heading, wings up. */
const bodyOf = (pose: Pose): Matrix => {
  let r = rotation([0, 0, 0], [0, 0, 1], Math.PI / 2);
  r = multiply(rotation([0, 0, 0], [1, 0, 0], pose.bank), r);
  r = multiply(rotation([0, 0, 0], [0, 1, 0], pose.pitch), r);
  r = multiply(rotation([0, 0, 0], [0, 0, 1], pose.heading), r);
  return multiply(translation(pose.x, pose.y, pose.z), multiply(r, multiply(scaling(pose.scale), translation(0, -LENGTH / 2, 0))));
};

/**
 * Rotation for every fold at the given angles, each about its crease as positioned by the folds
 * before it.
 */
const foldTurns = (angles: Angles): Matrix[] => {
  const turns: Matrix[] = [];
  folds.forEach((fold, i) => {
    let from: Vector = [fold.from[0], fold.from[1], 0];
    let to: Vector = [fold.to[0], fold.to[1], 0];
    if (fold.carriedBy !== undefined) {
      from = transform(turns[fold.carriedBy], from);
      to = transform(turns[fold.carriedBy], to);
    }
    const moving = Math.sign(
      (fold.to[0] - fold.from[0]) * (fold.side[1] - fold.from[1]) - (fold.to[1] - fold.from[1]) * (fold.side[0] - fold.from[0]),
    );
    const axis = normalize([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
    turns.push(rotation(from, axis, fold.towards * moving * angles[i]));
  });
  return turns;
};

/**
 * A piece's transform within the folded sheet: its fold rotations in order, after its lift above
 * the layers beneath.
 */
const pieceOf = (piece: Piece, turns: Matrix[], lift: number): Matrix => {
  let m = translation(0, 0, (piece.flips % 2 ? -1 : 1) * piece.layer * LAYER * lift);
  piece.moves.forEach((moves, i) => {
    if (moves) m = multiply(turns[i], m);
  });
  return m;
};

/**
 * Pre-rendered shadow sprite per theme. Dark theme: warm light with the airliner as a gap in it (a
 * shadow wouldn't read on a dark page). Light theme: a faint warm patch with a soft warm-gray
 * airliner shadow, like a shadow on sunlit paper.
 */
const shadowSprite = (dark: boolean) => {
  const size = 256;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const g = sprite.getContext('2d');
  if (!g) return sprite;
  const airliner = () => {
    g.save();
    g.translate(size * 0.14, size * 0.14);
    g.scale((size * 0.72) / 200, (size * 0.72) / 200);
    // Fill each part separately so overlaps aren't canceled out by the fill rule.
    for (const part of AIRLINER) g.fill(new Path2D(part));
    for (const [x, y, rx, ry] of ENGINES) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };
  if (dark) {
    const sun = getComputedStyle(document.documentElement).getPropertyValue('--sun').trim().split(/\s+/).join(',') || '241,178,102';
    const glow = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    glow.addColorStop(0, `rgba(${sun},0.55)`);
    glow.addColorStop(0.6, `rgba(${sun},0.18)`);
    glow.addColorStop(1, `rgba(${sun},0)`);
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'destination-out';
    g.filter = 'blur(3px)';
    g.fillStyle = '#000';
  } else {
    const sun = getComputedStyle(document.documentElement).getPropertyValue('--sun').trim().split(/\s+/).join(',') || '232,160,82';
    const glow = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    glow.addColorStop(0, `rgba(${sun},0.3)`);
    glow.addColorStop(0.65, `rgba(${sun},0.1)`);
    glow.addColorStop(1, `rgba(${sun},0)`);
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
    g.filter = 'blur(4px)';
    g.fillStyle = 'rgba(74,58,44,0.6)';
  }
  airliner();
  return sprite;
};

type Box = [number, number, number, number];

/** A drawing surface: position on the page and size in CSS px, plus its pixel ratio. */
interface Surface {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  left: number;
  top: number;
  width: number;
  height: number;
  ratio: number;
  /** Region drawn last frame, in CSS px; only that is cleared. */
  dirty: Box | null;
  shown: boolean;
}

const surfaceOf = (canvas: HTMLCanvasElement, g: CanvasRenderingContext2D): Surface => ({
  canvas,
  g,
  left: 0,
  top: 0,
  width: 1,
  height: 1,
  ratio: 1,
  dirty: null,
  shown: false,
});

/** Sizes a canvas in CSS and device pixels; resizing clears it. */
const resize = (surface: Surface, width: number, height: number, ratio: number) => {
  surface.width = Math.max(1, width);
  surface.height = Math.max(1, height);
  surface.ratio = ratio;
  const pixelsWide = Math.round(surface.width * ratio);
  const pixelsHigh = Math.round(surface.height * ratio);
  if (surface.canvas.width !== pixelsWide || surface.canvas.height !== pixelsHigh) {
    surface.canvas.width = pixelsWide;
    surface.canvas.height = pixelsHigh;
    surface.dirty = null;
  }
};

/**
 * Projects a page point (x, y) at height z as seen by an eye above (eyeX, eyeY), matching CSS
 * perspective; returns page px.
 */
const seen = (eyeX: number, eyeY: number, x: number, y: number, z: number) => {
  const f = PERSPECTIVE / (PERSPECTIVE - z);
  return [eyeX + (x - eyeX) * f, eyeY + (y - eyeY) * f];
};

export function initPlane() {
  const section = document.querySelector<HTMLElement>('[data-proverb]');
  const stage = document.querySelector<HTMLElement>('[data-rug]');
  const sheet = section?.querySelector<HTMLElement>('[data-sheet]');
  const screenCanvas = section?.querySelector<HTMLCanvasElement>('[data-plane]');
  const floorCanvas = stage?.querySelector<HTMLCanvasElement>('[data-plane-rest]');
  const screenContext = screenCanvas?.getContext('2d');
  const floorContext = floorCanvas?.getContext('2d');
  if (!section || !stage || !sheet || !screenCanvas || !floorCanvas || !screenContext || !floorContext) return;
  const header = document.querySelector<HTMLElement>('.site-header');
  // At rest the plane is drawn on the floor canvas inside the rug's stage (Rug.astro), which
  // scrolls with the rug natively. In flight it uses the fixed viewport canvas; drawing the resting
  // plane there would lag the rug by a frame while scrolling, since scrolling runs ahead of script.
  const floor = surfaceOf(floorCanvas, floorContext);
  const screen = surfaceOf(screenCanvas, screenContext);

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Draw the resting plane only once the rug covers it (`data-covered`, set by index.ts when the
  // flat image is fully shown; the 3D rug renders on top). On slow connections the image can arrive
  // after this script, and the plane would otherwise sit on the bare floor.
  const covered = () => stage.hasAttribute('data-covered');
  const items = foldSheet().pieces.map((piece) => ({ piece, points: [] as number[], depth: 0, color: '', edge: '' }));
  const sprites = new Map<boolean, HTMLCanvasElement>();

  // Layout measurements, refreshed on layout changes only, not on scroll.
  let rest: Pose;
  let out: Pose;
  let card: Pose;
  let start = 0;
  let end = 1;
  let measured = false;
  /**
   * Whether the plane has been revealed, and the scroll position at that moment; the flight starts
   * from there.
   */
  let found = false;
  let foundAt = -Infinity;
  // Viewport canvas position, and its center (the eye).
  let viewLeft = 0;
  let viewTop = 0;
  let eyeX = 0;
  let eyeY = 0;
  // Eye position for the floor canvas, and whether the resting plane has been drawn.
  let floorEyeX = 0;
  let floorEyeY = 0;
  let floorDrawn = false;

  const measure = () => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const box = stage.getBoundingClientRect();
    const styles = getComputedStyle(stage);
    const share = parseFloat(styles.getPropertyValue('--rug-share')) || 0.27;
    const angle = parseFloat(styles.getPropertyValue('--rug-angle')) || -0.5;
    const rug = box.width * share;
    const cx = box.left + scrollX + box.width / 2;
    const cy = box.top + scrollY + box.height / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const local = (x: number, y: number) => [cx + (x * cos - y * sin) * rug, cy + (x * sin + y * cos) * rug];
    // Under the curled corner, nose toward it and just poking out, as if slid there and forgotten
    // (assumes the rug is at least 40% of the stage width).
    const [rx, ry] = local(0.36, 0.7);
    const heading = Math.atan2(0.5 * sin + 0.8 * cos, 0.5 * cos - 0.8 * sin);
    rest = { x: rx, y: ry, z: 0, heading, pitch: 0, bank: 0, scale: (rug * 0.42) / LENGTH };
    // Clear of the corner onto the open floor; on narrow screens only just clear of the rug, so it
    // stays visible.
    const room = Math.cos(heading) > 0.1 ? (scrollX + window.innerWidth - 40 - rx) / Math.cos(heading) : Infinity;
    const slide = clamp(room, rug * 0.42, rug * 0.6);
    out = { ...rest, x: rx + Math.cos(heading) * slide, y: ry + Math.sin(heading) * slide };

    const paper = sheet.getBoundingClientRect();
    const wide = paper.width > paper.height;
    card = {
      x: paper.left + scrollX + paper.width / 2,
      y: paper.top + scrollY + paper.height / 2,
      z: 0,
      // Landing orientation: nose right on wide screens, nose down the page on tall ones.
      heading: wide ? 0 : Math.PI / 2,
      pitch: 0,
      bank: 0,
      scale: wide ? paper.width / LENGTH : paper.width,
    };

    // Flight range: from the rug centered in the viewport to the sheet in view, its bottom slightly
    // above the viewport's, never lower than the middle of the space below the header. The sheet
    // never exceeds that height (Proverb.astro).
    const top = header?.getBoundingClientRect().height ?? 64;
    const inSight = paper.bottom + scrollY - window.innerHeight + 40;
    const centered = card.y - (top + window.innerHeight) / 2;
    start = Math.max(cy - window.innerHeight / 2, foundAt);
    end = Math.max(start + 120, Math.min(inSight, centered));

    const ratio = pixelRatio();
    const view = screen.canvas.getBoundingClientRect();
    resize(screen, view.width, view.height, ratio);
    viewLeft = view.left;
    viewTop = view.top;
    eyeX = view.left + screen.width / 2;
    eyeY = view.top + screen.height / 2;

    // The floor canvas is drawn from the eye position the viewport canvas will have at takeoff, so
    // the handoff between canvases is seamless.
    floorEyeX = scrollX + eyeX;
    floorEyeY = start + eyeY;
    const [l, t, r, b] = shape(flying(0), floorEyeX, floorEyeY);
    const stageLeft = box.left + scrollX;
    const stageTop = box.top + scrollY;
    const x0 = Math.floor(Math.max(l - 3, stageLeft) - stageLeft);
    const x1 = Math.ceil(Math.min(r + 3, stageLeft + box.width) - stageLeft);
    const y0 = Math.floor(t - 3 - stageTop);
    const y1 = Math.ceil(b + 3 - stageTop);
    floor.left = stageLeft + x0;
    floor.top = stageTop + y0;
    resize(floor, x1 - x0, y1 - y0, ratio);
    const place = floor.canvas.style;
    place.left = `${x0}px`;
    place.top = `${y0}px`;
    place.width = `${floor.width}px`;
    place.height = `${floor.height}px`;
    floorDrawn = false;
    measured = true;
  };

  /**
   * Flight path: a curve from the floor beside the rug to just short of the sheet, arriving in its
   * landing orientation.
   */
  const path = (u: number) => {
    const length = Math.hypot(card.x - out.x, card.y - out.y);
    const arrive = [card.x - Math.cos(card.heading) * card.scale * 0.6, card.y - Math.sin(card.heading) * card.scale * 0.6 - length * 0.06];
    const away = [Math.cos(rest.heading), Math.sin(rest.heading)];
    // Swing out over the open side of the page first, then curve back; on narrow screens, turn back
    // before leaving it.
    const left = window.scrollX + window.innerWidth * 0.22;
    const right = window.scrollX + window.innerWidth * 0.78;
    const p0 = [out.x, out.y];
    const p1 = [clamp(out.x + away[0] * length * 0.4, left, right), out.y + away[1] * length * 0.25];
    const p2 = [clamp(arrive[0] - Math.cos(card.heading) * length * 0.28, left, right), arrive[1] - Math.sin(card.heading) * length * 0.28];
    const p3 = arrive;
    const v = 1 - u;
    const at = (k: number) => v * v * v * p0[k] + 3 * v * v * u * p1[k] + 3 * v * u * u * p2[k] + u * u * u * p3[k];
    const slope = (k: number) => 3 * v * v * (p1[k] - p0[k]) + 6 * v * u * (p2[k] - p1[k]) + 3 * u * u * (p3[k] - p2[k]);
    return { x: at(0), y: at(1), heading: Math.atan2(slope(1), slope(0)) };
  };

  /** In-flight state at scroll progress `t`: under the rug (0) to over the sheet (1). */
  const flying = (t: number): Moment => {
    const angles = [...FOLDED];
    // Mostly flat under the rug; opens up as it takes off.
    const opening = smoothstep(OUT, AIRBORNE, t);
    angles[4] = angles[5] = mix(0.52, FOLDED[4], opening);
    angles[6] = angles[7] = mix(0.49, FOLDED[6], opening);
    // Grows as it approaches; reaches the sheet's full size as it opens.
    const scale = mix(rest.scale, card.scale * 0.62, smoothstep(OUT, 1, t));
    if (t <= OUT) {
      const s = smoothstep(0, OUT, t);
      return { pose: { ...rest, x: mix(rest.x, out.x, s), y: mix(rest.y, out.y, s), scale }, angles, shadow: 0 };
    }
    const u = (t - OUT) / (1 - OUT);
    const p = path(u);
    const ahead = path(Math.min(1, u + 0.02));
    const behind = path(Math.max(0, u - 0.02));
    // Bank into turns, with a slight rock and pitch oscillation like a gliding paper plane.
    const bank = clamp(turn(behind.heading, ahead.heading) * -6, -0.8, 0.8) + 0.2 * Math.sin(u * Math.PI * 3);
    const airborne = smoothstep(OUT, AIRBORNE, t);
    return {
      pose: {
        x: p.x,
        y: p.y,
        z: Math.min(window.innerHeight * 0.22, 240) * smoothstep(OUT, 0.45, t) * (1 - 0.35 * smoothstep(0.75, 1, t)),
        heading: rest.heading + turn(rest.heading, p.heading) * airborne,
        pitch: 0.18 * Math.sin(u * Math.PI * 2) * (1 - smoothstep(0.85, 1, t)),
        bank: bank * airborne * (1 - smoothstep(0.85, 1, t)),
        scale,
      },
      angles,
      shadow: 1,
    };
  };

  /**
   * Landing state at progress `land`: descends onto the sheet's position, levels out and unfolds.
   */
  const landing = (from: Moment, land: number): Moment => {
    if (land <= 0) return from;
    const settle = smoothstep(0, 0.62, land);
    const angles = [...from.angles];
    angles[6] = angles[7] = from.angles[6] * (1 - smoothstep(0, 0.3, land));
    angles[4] = angles[5] = from.angles[4] * (1 - smoothstep(0.18, 0.5, land));
    angles[2] = angles[3] = Math.PI * (1 - smoothstep(0.42, 0.74, land));
    angles[0] = angles[1] = Math.PI * (1 - smoothstep(0.68, 1, land));
    const { pose } = from;
    return {
      pose: {
        x: mix(pose.x, card.x, settle),
        y: mix(pose.y, card.y, settle),
        z: pose.z * (1 - settle),
        heading: pose.heading + turn(pose.heading, card.heading) * settle,
        pitch: pose.pitch * (1 - settle),
        bank: pose.bank * (1 - settle),
        scale: mix(pose.scale, card.scale, smoothstep(0.05, 0.8, land)),
      },
      angles,
      shadow: from.shadow * (1 - smoothstep(0, 0.35, land)),
    };
  };

  /**
   * Projects and shades the plane's pieces as seen from (eyeX, eyeY), in page px; returns their
   * bounding box.
   */
  const shape = ({ pose, angles }: Moment, eyeX: number, eyeY: number) => {
    const lift = clamp((angles[0] + angles[1] + angles[2] + angles[3]) / (2 * Math.PI));
    const turns = foldTurns(angles);
    const body = bodyOf(pose);
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const item of items) {
      const m = multiply(body, pieceOf(item.piece, turns, lift));
      item.points.length = 0;
      let depth = 0;
      for (const [x, y] of item.piece.outline) {
        const p = transform(m, [x, y, 0]);
        const [sx, sy] = seen(eyeX, eyeY, p[0], p[1], p[2]);
        item.points.push(sx, sy);
        depth += p[2];
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        top = Math.min(top, sy);
        bottom = Math.max(bottom, sy);
      }
      item.depth = depth / item.piece.outline.length;
      // Shade by the upward-facing side; the back is slightly grayer than the front.
      const n = normalize([m[8], m[9], m[10]]);
      const up = n[2] >= 0 ? 1 : -1;
      const light = Math.max(0, up * (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));
      const brightness = Math.min(1.05, ((0.66 + 0.34 * light) / (0.66 + 0.34 * LIGHT[2])) * (up > 0 ? 1 : 0.97));
      item.color = `rgb(${PAPER.map((value) => Math.min(255, Math.round(value * brightness))).join(',')})`;
      // Slightly darker edges: creases and the paper's edge.
      item.edge = `rgb(${PAPER.map((value) => Math.round(value * brightness * 0.93)).join(',')})`;
    }
    return [left, top, right, bottom];
  };

  /**
   * Draws the plane and its shadow on a surface, seen from (eyeX, eyeY). Returns false if nothing
   * lands on the canvas.
   */
  const paint = (moment: Moment, surface: Surface, eyeX: number, eyeY: number) => {
    const { pose, shadow } = moment;
    const [left, top, right, bottom] = shape(moment, eyeX, eyeY);

    // Ground shadow from the window light, larger than the plane itself.
    const span = pose.scale * LENGTH * 1.6 * (1 + pose.z / 900);
    const dark = document.documentElement.dataset.theme === 'dark';
    const opacity = (dark ? 0.22 : 0.42) * shadow * smoothstep(20, 90, pose.z);
    const [gx, gy] = seen(eyeX, eyeY, pose.x + pose.z * 0.32, pose.y + pose.z * 0.5, 0);
    // From here on, coordinates are in canvas pixels.
    const ox = surface.left;
    const oy = surface.top;
    const margin = 40;
    const inside = (l: number, r: number, t: number, b: number) =>
      r - ox > -margin && l - ox < surface.width + margin && b - oy > -margin && t - oy < surface.height + margin;
    const shadowSeen = opacity > 0.002 && inside(gx - span, gx + span, gy - span, gy + span);
    if (!inside(left, right, top, bottom) && !shadowSeen) return false;

    const { g, ratio } = surface;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    const last = surface.dirty;
    if (last) g.clearRect(last[0], last[1], last[2] - last[0], last[3] - last[1]);
    else g.clearRect(0, 0, surface.width, surface.height);
    // Dirty region: the paper (plus stroke width) and the rotated shadow sprite, i.e. its
    // half-diagonal.
    const reach = span * 0.71;
    const dirty: Box = [left - 2 - ox, top - 2 - oy, right + 2 - ox, bottom + 2 - oy];
    if (shadowSeen) {
      dirty[0] = Math.min(dirty[0], gx - reach - ox);
      dirty[1] = Math.min(dirty[1], gy - reach - oy);
      dirty[2] = Math.max(dirty[2], gx + reach - ox);
      dirty[3] = Math.max(dirty[3], gy + reach - oy);
    }
    surface.dirty = dirty;
    g.setTransform(ratio, 0, 0, ratio, -ox * ratio, -oy * ratio);
    if (shadowSeen) {
      let sprite = sprites.get(dark);
      if (!sprite) {
        sprite = shadowSprite(dark);
        sprites.set(dark, sprite);
      }
      g.save();
      g.globalAlpha = opacity;
      g.translate(gx, gy);
      g.rotate(pose.heading);
      g.drawImage(sprite, -span / 2, -span / 2, span, span);
      g.restore();
    }
    // Back to front; stacked paper in layer order.
    items.sort((a, b) => a.depth - b.depth || a.piece.layer - b.piece.layer);
    g.lineJoin = 'round';
    g.lineWidth = 0.75;
    for (const item of items) {
      const p = item.points;
      g.beginPath();
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
      g.closePath();
      g.fillStyle = item.color;
      g.fill();
      g.strokeStyle = item.edge;
      g.stroke();
    }
    return true;
  };

  /**
   * Shows or hides a surface. Hiding clears the viewport canvas (it only clears its last dirty
   * region when redrawn); the floor canvas keeps the static resting plane.
   */
  const show = (surface: Surface, value: boolean) => {
    if (value === surface.shown) return;
    surface.shown = value;
    surface.canvas.style.visibility = value ? 'visible' : 'hidden';
    if (!value && surface === screen) {
      surface.g.setTransform(1, 0, 0, 1, 0, 0);
      surface.g.clearRect(0, 0, surface.canvas.width, surface.canvas.height);
      surface.dirty = null;
    }
  };

  let frame = 0;
  let land = 0;
  let target = 0;
  let previous = 0;
  let first = true;
  let landed = false;
  let aloft = false;

  const draw = (time: number) => {
    frame = 0;
    if (!measured) measure();
    const flies = found && !still;
    const t = flies ? clamp((window.scrollY - start) / (end - start)) : 0;
    // Land once the sheet is visible; take off again only after scrolling back a bit, to avoid
    // flicker at the threshold.
    if (flies && t >= 1) target = 1;
    else if (t < 0.9) target = 0;
    if (first) {
      // Arriving already scrolled past the sheet: show it unfolded immediately.
      land = target;
      first = false;
    } else if (land !== target) {
      // Wall-clock seconds, capped: on slow devices the landing takes the same time in fewer
      // frames.
      const dt = previous ? Math.min(0.25, (time - previous) / 1000) : 0;
      land = target > land ? Math.min(1, land + dt / LANDING) : Math.max(0, land - dt / LANDING);
    }
    previous = land !== target ? time : 0;
    if (land !== target) schedule();

    if (land >= 1 !== landed) {
      landed = land >= 1;
      section.toggleAttribute('data-landed', landed);
    }
    // Out from under the rug: switch to the viewport canvas.
    if ((t > OUT || land > 0) !== aloft) {
      aloft = t > OUT || land > 0;
      screen.canvas.toggleAttribute('data-aloft', aloft);
    }
    if (landed || (!aloft && !covered())) {
      show(screen, false);
      show(floor, false);
      return;
    }
    if (t <= 0 && land <= 0) {
      // At rest under the rug: draw once on the floor canvas.
      if (!floorDrawn) floorDrawn = paint(flying(0), floor, floorEyeX, floorEyeY);
      show(floor, true);
      show(screen, false);
      return;
    }
    screen.left = window.scrollX + viewLeft;
    screen.top = window.scrollY + viewTop;
    show(screen, paint(landing(flying(t), land), screen, window.scrollX + eyeX, window.scrollY + eyeY));
    show(floor, false);
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  const remeasure = () => {
    measured = false;
    schedule();
  };

  // Revealed once the rug has been opened (`data-looked`, set by index.ts and scene.ts and never
  // removed), even if that happened before this module loaded.
  const find = () => {
    if (found || still || !stage.hasAttribute('data-looked')) return;
    found = true;
    foundAt = window.scrollY;
    section.setAttribute('data-flight', '');
    remeasure();
  };
  // Pre-render the blurred shadow sprite during idle time rather than on the first frame of the
  // flight.
  const warm = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    if (!sprites.has(dark)) sprites.set(dark, shadowSprite(dark));
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 2000 });
  else setTimeout(warm, 500);

  new MutationObserver(find).observe(stage, { attributes: true, attributeFilter: ['data-looked'] });
  new MutationObserver(schedule).observe(stage, { attributes: true, attributeFilter: ['data-covered'] });
  find();
  // Both canvases start hidden; the floor canvas via CSS (Rug.astro).
  screen.canvas.hidden = false;
  screen.shown = true;
  show(screen, false);
  floor.canvas.hidden = false;
  schedule();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure);
  new ResizeObserver(remeasure).observe(document.body);
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

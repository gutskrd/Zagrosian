/**
 * The paper plane under the rug (Rug.astro). It stays there until it is
 * found: the rug lifted, by the "Lift the rug" button or by hand. Until then
 * the sheet the proverb is written on (Proverb.astro) simply lies where it is.
 * Found, and the page scrolled on, the plane slips out from under the rug's
 * corner, opens its wings and flies down the page; once the sheet is fully in
 * sight, it comes down onto it and unfolds into it, by itself, so the sheet is
 * always there to be read wherever the scrolling stops. Scrolled back, it
 * folds up again and flies home under the rug.
 *
 * The plane is folded as one is by hand (plane-folds.ts). It is drawn on one
 * canvas over the screen, a flat 2D drawing: each frame its pieces are placed
 * in 3D, seen from the reader's eye (as CSS perspective would), shaded by how
 * they face the light, and painted from the furthest to the nearest. That is
 * a few dozen polygons a frame, light even for a slow phone, with nothing
 * kept on the graphics card. Its shadow on the page, an airliner's (a paper
 * plane dreaming), is drawn once and then only stamped. While it lies under
 * the rug the canvas is beneath the rug's, so the rug covers it and the rug's
 * shadow falls on it; once out, it is over the page, under the header.
 *
 * The proverb is real text throughout, read by screen readers whatever the
 * plane is doing; it is only out of sight while the plane carries it. With
 * reduced motion the plane stays under the rug and the sheet simply lies
 * there.
 */
import { pixelRatio } from './device';
import { FOLDED, LENGTH, folds, foldSheet, type Piece } from './plane-folds';

type Matrix = Float64Array;
type Vector = [number, number, number];

/** How far apart the layers of folded paper are kept, in sheets, so none is drawn through another. */
const LAYER = 0.0025;
/** How far the reader's eye is from the page, in pixels, as CSS perspective. */
const PERSPECTIVE = 1500;
/** The light, from the upper left and in front, as on the rug. */
const LIGHT: Vector = normalise([-0.42, -0.55, 0.72]);
/** The sheet's paper (Proverb.astro): lying flat and facing up, the plane is exactly this colour. */
const PAPER: Vector = [243, 239, 230];

// The scroll, from the rug centred on the screen (0) to the sheet fully in sight (1).
/** Slid out from under the rug. */
const OUT = 0.14;
/** Wings open, in the air. */
const AIRBORNE = 0.26;
/** How long landing and unfolding take, in seconds, once the sheet is in sight. */
const LANDING = 1.5;

/** An airliner from above, nose to the right, in a 200 square: fuselage, wings, tailplane, engines. */
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

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const smooth = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** The angle from a to b the short way round. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function normalise([x, y, z]: Vector): Vector {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

const identity = (): Matrix => {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
};

/** a then b, as one: b applied after a. Column-major. */
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

/** A turn by `angle` about the line through `point` along `axis` (a unit vector), right-handed. */
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

/** Where the plane is and how it lies: page position in pixels, height above the page, and its turns. */
interface Pose {
  x: number;
  y: number;
  z: number;
  /** Which way the nose points on the page (radians from the right, clockwise). */
  heading: number;
  /** Nose down into the page. */
  pitch: number;
  /** Rolled about its length. */
  bank: number;
  /** Pixels to the sheet's width. */
  scale: number;
}

/** Each fold's angle now, from 0 (open) to its full angle (FOLDED). */
type Angles = number[];

interface Moment {
  pose: Pose;
  angles: Angles;
  /** How much of its shadow shows, from 0 to 1. */
  shadow: number;
}

/**
 * The plane as a whole: the sheet's middle (the spine's midpoint) at the
 * pose's place, its nose along the heading, its wings up off the page.
 */
const bodyOf = (pose: Pose): Matrix => {
  let r = rotation([0, 0, 0], [0, 0, 1], Math.PI / 2);
  r = multiply(rotation([0, 0, 0], [1, 0, 0], pose.bank), r);
  r = multiply(rotation([0, 0, 0], [0, 1, 0], pose.pitch), r);
  r = multiply(rotation([0, 0, 0], [0, 0, 1], pose.heading), r);
  return multiply(translation(pose.x, pose.y, pose.z), multiply(r, multiply(scaling(pose.scale), translation(0, -LENGTH / 2, 0))));
};

/** Every fold's turn, at the given angles: each about its crease, where earlier folds have put it. */
const foldTurns = (angles: Angles): Matrix[] => {
  const turns: Matrix[] = [];
  folds.forEach((fold, i) => {
    let from: Vector = [fold.from[0], fold.from[1], 0];
    let to: Vector = [fold.to[0], fold.to[1], 0];
    if (fold.carriedBy !== undefined) {
      from = transform(turns[fold.carriedBy], from);
      to = transform(turns[fold.carriedBy], to);
    }
    const moving = Math.sign((fold.to[0] - fold.from[0]) * (fold.side[1] - fold.from[1]) - (fold.to[1] - fold.from[1]) * (fold.side[0] - fold.from[0]));
    const axis = normalise([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
    turns.push(rotation(from, axis, fold.towards * moving * angles[i]));
  });
  return turns;
};

/** A piece's place in the folded sheet: the turns of its folds, in order, after its lift off the layers under it. */
const pieceOf = (piece: Piece, turns: Matrix[], lift: number): Matrix => {
  let m = translation(0, 0, (piece.flips % 2 ? -1 : 1) * piece.layer * LAYER * lift);
  piece.moves.forEach((moves, i) => {
    if (moves) m = multiply(turns[i], m);
  });
  return m;
};

/**
 * The shadow, drawn once for each theme. On a dark page, where a shadow cannot
 * be seen, warm light with the airliner a gap in it; on a light one, a faint
 * warmth of the same light with the airliner's shadow in it, soft and warm
 * grey, as a shadow is on paper in the sun.
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
    // Each part on its own, so where they overlap is not left out.
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

export function initPlane() {
  const section = document.querySelector<HTMLElement>('[data-proverb]');
  const stage = document.querySelector<HTMLElement>('[data-rug]');
  const sheet = section?.querySelector<HTMLElement>('[data-sheet]');
  const canvas = section?.querySelector<HTMLCanvasElement>('[data-plane]');
  const context = canvas?.getContext('2d');
  if (!section || !stage || !sheet || !canvas || !context) return;
  const g = context;
  const header = document.querySelector<HTMLElement>('.site-header');

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = foldSheet().pieces.map((piece) => ({ piece, points: [] as number[], depth: 0, colour: '', edge: '' }));
  const sprites = new Map<boolean, HTMLCanvasElement>();

  // Where things are on the page, measured when the layout changes, not as it scrolls.
  let rest: Pose;
  let out: Pose;
  let card: Pose;
  let start = 0;
  let end = 1;
  let measured = false;
  /** Whether the plane has been found, and where the page was then: it sets off from there. */
  let found = false;
  let foundAt = -Infinity;
  // The canvas: its size, and where on the screen its middle (the eye) is.
  let width = 1;
  let height = 1;
  let ratio = 1;
  let eyeX = 0;
  let eyeY = 0;

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
    // Under the corner that turns up, nose towards it and just out from under
    // it, as if slid there and forgotten; as long as the rug is two fifths wide.
    const [rx, ry] = local(0.36, 0.7);
    const heading = Math.atan2(0.5 * sin + 0.8 * cos, 0.5 * cos - 0.8 * sin);
    rest = { x: rx, y: ry, z: 0, heading, pitch: 0, bank: 0, scale: (rug * 0.42) / LENGTH };
    // Out past the corner, onto the open floor: on a narrow screen, only just
    // clear of the rug, so it stays in sight.
    const room = Math.cos(heading) > 0.1 ? (scrollX + window.innerWidth - 40 - rx) / Math.cos(heading) : Infinity;
    const slide = clamp(room, rug * 0.42, rug * 0.6);
    out = { ...rest, x: rx + Math.cos(heading) * slide, y: ry + Math.sin(heading) * slide };

    const paper = sheet.getBoundingClientRect();
    const wide = paper.width > paper.height;
    card = {
      x: paper.left + scrollX + paper.width / 2,
      y: paper.top + scrollY + paper.height / 2,
      z: 0,
      // Wide, it lands nose to the right; tall, nose down the page.
      heading: wide ? 0 : Math.PI / 2,
      pitch: 0,
      bank: 0,
      scale: wide ? paper.width / LENGTH : paper.width,
    };

    // From the rug in the middle of the screen to the sheet in sight: its
    // foot a little above the screen's, never further than in the middle of
    // what the header leaves. The sheet is never taller than that (Proverb.astro).
    const top = header?.getBoundingClientRect().height ?? 64;
    const inSight = paper.bottom + scrollY - window.innerHeight + 40;
    const centred = card.y - (top + window.innerHeight) / 2;
    start = Math.max(cy - window.innerHeight / 2, foundAt);
    end = Math.max(start + 120, Math.min(inSight, centred));

    const view = canvas.getBoundingClientRect();
    ratio = pixelRatio();
    width = Math.max(1, view.width);
    height = Math.max(1, view.height);
    eyeX = view.left + width / 2;
    eyeY = view.top + height / 2;
    const pixelsWide = Math.round(width * ratio);
    const pixelsHigh = Math.round(height * ratio);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    measured = true;
  };

  /** The way down: a curve from the floor by the rug to just short of the sheet, coming in the way it will lie. */
  const path = (u: number) => {
    const length = Math.hypot(card.x - out.x, card.y - out.y);
    const arrive = [card.x - Math.cos(card.heading) * card.scale * 0.6, card.y - Math.sin(card.heading) * card.scale * 0.6 - length * 0.06];
    const away = [Math.cos(rest.heading), Math.sin(rest.heading)];
    // Out over the open side of the page first, then round; on a narrow
    // screen, turning back before it leaves it.
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

  /** In flight, at t of the scroll: under the rug (0) to over the sheet (1). */
  const flying = (t: number): Moment => {
    const angles = [...FOLDED];
    // Pressed flat-ish under the rug; it opens as it takes to the air.
    const opening = smooth(OUT, AIRBORNE, t);
    angles[4] = angles[5] = mix(0.52, FOLDED[4], opening);
    angles[6] = angles[7] = mix(0.49, FOLDED[6], opening);
    // It comes nearer as it flies; the sheet's full size comes as it opens.
    const scale = mix(rest.scale, card.scale * 0.62, smooth(OUT, 1, t));
    if (t <= OUT) {
      const s = smooth(0, OUT, t);
      return { pose: { ...rest, x: mix(rest.x, out.x, s), y: mix(rest.y, out.y, s), scale }, angles, shadow: 0 };
    }
    const u = (t - OUT) / (1 - OUT);
    const p = path(u);
    const ahead = path(Math.min(1, u + 0.02));
    const behind = path(Math.max(0, u - 0.02));
    // Into the turns, rocking a little as paper does, nose down and up as it glides.
    const bank = clamp(turn(behind.heading, ahead.heading) * -6, -0.8, 0.8) + 0.2 * Math.sin(u * Math.PI * 3);
    const airborne = smooth(OUT, AIRBORNE, t);
    return {
      pose: {
        x: p.x,
        y: p.y,
        z: Math.min(window.innerHeight * 0.22, 240) * smooth(OUT, 0.45, t) * (1 - 0.35 * smooth(0.75, 1, t)),
        heading: rest.heading + turn(rest.heading, p.heading) * airborne,
        pitch: 0.18 * Math.sin(u * Math.PI * 2) * (1 - smooth(0.85, 1, t)),
        bank: bank * airborne * (1 - smooth(0.85, 1, t)),
        scale,
      },
      angles,
      shadow: 1,
    };
  };

  /** Landing, `land` of the way: down onto the sheet's place, turned flat, and opened out. */
  const landing = (from: Moment, land: number): Moment => {
    if (land <= 0) return from;
    const settle = smooth(0, 0.62, land);
    const angles = [...from.angles];
    angles[6] = angles[7] = from.angles[6] * (1 - smooth(0, 0.3, land));
    angles[4] = angles[5] = from.angles[4] * (1 - smooth(0.18, 0.5, land));
    angles[2] = angles[3] = Math.PI * (1 - smooth(0.42, 0.74, land));
    angles[0] = angles[1] = Math.PI * (1 - smooth(0.68, 1, land));
    const { pose } = from;
    return {
      pose: {
        x: mix(pose.x, card.x, settle),
        y: mix(pose.y, card.y, settle),
        z: pose.z * (1 - settle),
        heading: pose.heading + turn(pose.heading, card.heading) * settle,
        pitch: pose.pitch * (1 - settle),
        bank: pose.bank * (1 - settle),
        scale: mix(pose.scale, card.scale, smooth(0.05, 0.8, land)),
      },
      angles,
      shadow: from.shadow * (1 - smooth(0, 0.35, land)),
    };
  };

  /** Draws the plane and its shadow; false when none of it is on the screen. */
  const paint = ({ pose, angles, shadow }: Moment) => {
    const camX = window.scrollX + eyeX;
    const camY = window.scrollY + eyeY;
    const project = (x: number, y: number, z: number) => {
      const f = PERSPECTIVE / (PERSPECTIVE - z);
      return [width / 2 + (x - camX) * f, height / 2 + (y - camY) * f];
    };

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
        const [sx, sy] = project(p[0], p[1], p[2]);
        item.points.push(sx, sy);
        depth += p[2];
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        top = Math.min(top, sy);
        bottom = Math.max(bottom, sy);
      }
      item.depth = depth / item.piece.outline.length;
      // Shaded by the side that faces up, the back a touch greyer than the front.
      const n = normalise([m[8], m[9], m[10]]);
      const up = n[2] >= 0 ? 1 : -1;
      const light = Math.max(0, up * (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));
      const brightness = Math.min(1.05, ((0.66 + 0.34 * light) / (0.66 + 0.34 * LIGHT[2])) * (up > 0 ? 1 : 0.97));
      item.colour = `rgb(${PAPER.map((value) => Math.min(255, Math.round(value * brightness))).join(',')})`;
      // Its edges a shade darker: the creases, and the paper's edge.
      item.edge = `rgb(${PAPER.map((value) => Math.round(value * brightness * 0.93)).join(',')})`;
    }

    // The shadow on the page below, cast by the window's light: larger than a paper plane's.
    const span = pose.scale * LENGTH * 1.6 * (1 + pose.z / 900);
    const dark = document.documentElement.dataset.theme === 'dark';
    const opacity = (dark ? 0.22 : 0.42) * shadow * smooth(20, 90, pose.z);
    const [gx, gy] = project(pose.x + pose.z * 0.32, pose.y + pose.z * 0.5, 0);
    const margin = 40;
    const seen = (l: number, r: number, t: number, b: number) => r > -margin && l < width + margin && b > -margin && t < height + margin;
    const shadowSeen = opacity > 0.002 && seen(gx - span, gx + span, gy - span, gy + span);
    if (!seen(left, right, top, bottom) && !shadowSeen) return false;

    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, width, height);
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
    // Furthest first; paper lying on paper in the order it is stacked.
    items.sort((a, b) => a.depth - b.depth || a.piece.layer - b.piece.layer);
    g.lineJoin = 'round';
    g.lineWidth = 0.75;
    for (const item of items) {
      const p = item.points;
      g.beginPath();
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
      g.closePath();
      g.fillStyle = item.colour;
      g.fill();
      g.strokeStyle = item.edge;
      g.stroke();
    }
    return true;
  };

  let frame = 0;
  let land = 0;
  let target = 0;
  let previous = 0;
  let first = true;
  let landed = false;
  let aloft = false;
  let shown = false;
  const show = (value: boolean) => {
    if (value === shown) return;
    shown = value;
    canvas.style.visibility = value ? 'visible' : 'hidden';
    if (!value) g.clearRect(0, 0, canvas.width, canvas.height);
  };

  const draw = (time: number) => {
    frame = 0;
    if (!measured) measure();
    const flies = found && !still;
    const t = flies ? clamp((window.scrollY - start) / (end - start)) : 0;
    // Landing once the sheet is in sight; taking off again only when scrolled
    // a little way back, so it does not flutter at the threshold.
    if (flies && t >= 1) target = 1;
    else if (t < 0.9) target = 0;
    if (first) {
      // Arriving at a page already scrolled past, the sheet is simply there.
      land = target;
      first = false;
    } else if (land !== target) {
      // In seconds, as they pass: on a slow device it lands in the same time, in fewer frames.
      const dt = previous ? Math.min(0.25, (time - previous) / 1000) : 0;
      land = target > land ? Math.min(1, land + dt / LANDING) : Math.max(0, land - dt / LANDING);
    }
    previous = land !== target ? time : 0;
    if (land !== target) schedule();

    if (land >= 1 !== landed) {
      landed = land >= 1;
      section.toggleAttribute('data-landed', landed);
    }
    if (landed) {
      show(false);
      return;
    }
    // Out from under the rug, it flies over the page.
    if ((t > OUT || land > 0) !== aloft) {
      aloft = t > OUT || land > 0;
      canvas.toggleAttribute('data-aloft', aloft);
    }
    show(paint(landing(flying(t), land)));
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  const remeasure = () => {
    measured = false;
    schedule();
  };

  // Found once someone has looked under the rug (`data-looked`, which stays:
  // rug.ts and rug-scene.ts set it when the rug is lifted or picked up), even
  // before this script came: from then on, it flies.
  const find = () => {
    if (found || still || !stage.hasAttribute('data-looked')) return;
    found = true;
    foundAt = window.scrollY;
    section.setAttribute('data-flight', '');
    remeasure();
  };
  new MutationObserver(find).observe(stage, { attributes: true, attributeFilter: ['data-looked'] });
  find();
  canvas.hidden = false;
  shown = true;
  show(false);
  schedule();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure);
  new ResizeObserver(remeasure).observe(document.body);
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

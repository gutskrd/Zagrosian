// Draws the rug (Rug.astro, rug-scene.ts) and saves it as
// src/assets/rug/rug.webp, and smaller as rug-small.webp for phones and
// ordinary screens (so the rug is there sooner on a slow connection): a pile rug after those of Bijar and Senneh, Kurdish
// weaving towns in the Zagros. A madder-red field with a lobed indigo
// medallion at its heart, pendants on stems at either end, ivory corners
// scalloped like the medallion; flowers, palmettes and leaves on a running
// vine all over the field; an indigo main border of rosettes on a vine
// between narrow guards; and the warp left as a fringe at both ends. It is
// symmetrical about both axes, as such rugs are. The design is our own, drawn
// from the conventions of the type.
//
// It is drawn on a canvas in a headless browser (Playwright, as the tests
// use), so what is saved is what a browser draws. The 3D rug lays its pile
// and its light over it; where there is no 3D, the picture is shown as it is.
//
// Usage: node scripts/rug.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const OUT = fileURLToPath(new URL('../src/assets/rug/', import.meta.url));
/** In knots of two by two, as rug-scene.ts lays it out: across, along, and the fringe at each end. */
const ACROSS = 101;
const ALONG = 161;
const FRINGE = 6;
/** Pixels to a cell: about as fine as the rug is ever seen; and for the smaller picture. */
const SCALE = 10;
const SMALL_SCALE = 6;

/** Runs in the browser: the whole drawing, in cells, then the picture as WebP. */
function draw({ across: W, along: H, fringe, scale }) {
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = (H + 2 * fringe) * scale;
  const g = canvas.getContext('2d');
  const TAU = Math.PI * 2;

  // The same rug every time.
  let seed = 1919;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (a, b) => a + (b - a) * random();

  // Madder, indigo, undyed ivory, and the few colours dyed from them.
  const C = {
    red: '#982b1e',
    redDeep: '#6f1d15',
    redLight: '#b5463a',
    rose: '#c9705c',
    navy: '#1b2140',
    navyDeep: '#11152a',
    ivory: '#e8dbbd',
    ivoryDeep: '#cdb78f',
    gold: '#c39150',
    green: '#56664a',
    sky: '#6b82a3',
    binding: '#561710',
  };

  const shape = (points) => {
    g.beginPath();
    points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  const fill = (colour) => {
    g.fillStyle = colour;
    g.fill();
  };
  const stroke = (colour, width) => {
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  };
  const circle = (x, y, r, colour) => {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    fill(colour);
  };

  /**
   * A flower seen from above: `petals` petals round its heart, each outlined
   * in a darker wool as woven flowers are, then rings of [share of r, colour].
   */
  const rosette = (x, y, r, petals, colours, rings = [], turn = 0) => {
    const tangential = r * Math.sin(Math.PI / petals) * 0.8;
    for (let i = 0; i < petals; i++) {
      const a = turn + (i / petals) * TAU;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.47, tangential, a, 0, TAU);
      fill(colours[i % colours.length]);
      stroke('rgb(44 20 16 / 0.5)', Math.max(0.12, r * 0.05));
    }
    for (const [share, colour] of rings) circle(x, y, r * share, colour);
  };

  /** A leaf from (x, y), `length` long along `angle`, with a vein if given. */
  const leaf = (x, y, length, width, angle, colour, vein) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(length * 0.45, -width, length, 0);
    g.quadraticCurveTo(length * 0.45, width, 0, 0);
    fill(colour);
    if (vein) {
      g.beginPath();
      g.moveTo(length * 0.12, 0);
      g.lineTo(length * 0.8, 0);
      stroke(vein, width * 0.22);
    }
    g.restore();
  };

  /** A palmette: a cup with a fan of five leaves, pointing along `angle`. */
  const palmette = (x, y, size, angle, colour, cup) => {
    for (let i = -2; i <= 2; i++) leaf(x, y, size * (1 - Math.abs(i) * 0.14), size * 0.2, angle + i * 0.38, colour);
    circle(x, y, size * 0.32, cup);
  };

  /** A star of `points` points, `inner` its waist as a share of r. */
  const star = (x, y, r, inner, points, colour, turn = -Math.PI / 2) => {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const rr = i % 2 ? r * inner : r;
      const a = turn + (i * Math.PI) / points;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    shape(pts);
    fill(colour);
  };

  /** Draws `draw` four times about (cx, cy), mirrored, as the rug is: the same chances each time. */
  const four = (cx, cy, draw) => {
    const start = seed;
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        seed = start;
        g.save();
        g.translate(cx, cy);
        g.scale(sx, sy);
        draw();
        g.restore();
      }
    }
  };

  /** Points in a quarter, no two closer than `gap`, where `free` allows. */
  const scatter = (width, height, gap, free, taken = []) => {
    const points = [...taken];
    for (let tries = 0; tries < 2400; tries++) {
      const x = random() * width;
      const y = random() * height;
      if (!free(x, y)) continue;
      if (points.some((p) => Math.hypot(p.x - x, p.y - y) < Math.max(gap, p.gap ?? 0))) continue;
      points.push({ x, y });
    }
    return points.slice(taken.length);
  };

  /** A thin vine from each point to its nearest neighbours, curving as it goes. */
  const vines = (points, colour, width) => {
    for (const p of points) {
      const near = points
        .filter((q) => q !== p)
        .map((q) => ({ q, d: Math.hypot(q.x - p.x, q.y - p.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, random() < 0.45 ? 2 : 1);
      for (const { q, d } of near) {
        if (d > 9) continue;
        const bend = (random() < 0.5 ? -1 : 1) * d * 0.28;
        const mx = (p.x + q.x) / 2 - ((q.y - p.y) / d) * bend;
        const my = (p.y + q.y) / 2 + ((q.x - p.x) / d) * bend;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.quadraticCurveTo(mx, my, q.x, q.y);
        stroke(colour, width);
        // A small leaf where the vine bends.
        if (random() < 0.5) leaf(mx, my, 1.5, 0.5, Math.atan2(q.y - p.y, q.x - p.x) + 0.7, C.green);
      }
    }
  };

  /** A scalloped outline: the polygon `corners`, its edges bowed out in `lobes` lobes each. */
  const lobed = (corners, lobes, depth, cx, cy) => {
    const pts = [];
    for (let i = 0; i < corners.length; i++) {
      const [ax, ay] = corners[i];
      const [bx, by] = corners[(i + 1) % corners.length];
      const length = Math.hypot(bx - ax, by - ay);
      let nx = (by - ay) / length;
      let ny = -(bx - ax) / length;
      // Outwards, away from the centre.
      if (nx * ((ax + bx) / 2 - cx) + ny * ((ay + by) / 2 - cy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      for (let k = 0; k < 48; k++) {
        const s = k / 48;
        const bulge = depth * Math.abs(Math.sin(Math.PI * lobes * s));
        pts.push([ax + (bx - ax) * s + nx * bulge, ay + (by - ay) * s + ny * bulge]);
      }
    }
    return pts;
  };

  /** The same outline, drawn in towards (cx, cy) by `by`. */
  const inset = (pts, cx, cy, by) =>
    pts.map(([x, y]) => {
      const d = Math.hypot(x - cx, y - cy) || 1;
      return [x - ((x - cx) / d) * by, y - ((y - cy) / d) * by];
    });

  // --- The weave, in cells ------------------------------------------------
  g.setTransform(scale, 0, 0, scale, 0, fringe * scale);
  const cx = W / 2;
  const cy = H / 2;
  // The field, inside the borders.
  const EDGE = 20.5;
  const hx = cx - EDGE;
  const hy = cy - EDGE;
  // The medallion's half width and half length.
  const a = 19;
  const b = 31;

  g.fillStyle = C.red;
  g.fillRect(0, 0, W, H);

  // The field: flowers, palmettes and leaves on a vine, in one quarter, mirrored.
  const freeInField = (x, y) =>
    x > 2.3 &&
    y > 2.3 &&
    x < hx - 2.6 &&
    y < hy - 2.6 &&
    x / (a + 3.5) + y / (b + 3.5) > 1 &&
    !(x < 5 && y < b + 15) &&
    !(y < 5.5 && x < a + 10) &&
    ((hx - x) / 18) ** 2 + ((hy - y) / 24.5) ** 2 > 1;
  // Large leaves first, the way the reference rugs lean them towards the heart.
  const feathers = [
    { x: 21.5, y: 21, angle: -2.2, gap: 5.5 },
    { x: 9.5, y: 44, angle: -1.75, gap: 5.5 },
    { x: 23, y: 33.5, angle: -2.6, gap: 5 },
    { x: 15, y: 50, angle: -2.05, gap: 5 },
    { x: 26.5, y: 9, angle: -2.9, gap: 5 },
  ];
  const field = scatter(hx, hy, 3.15, freeInField, feathers);
  const flowers = field.map((p) => ({ ...p, kind: random() }));
  four(cx, cy, () => {
    vines([...feathers, ...flowers], C.ivoryDeep, 0.3);
    for (const f of feathers) {
      leaf(f.x, f.y, 7.5, 2.1, f.angle, C.ivory);
      leaf(f.x, f.y, 6.6, 1.45, f.angle, C.navy, C.sky);
    }
    for (const f of flowers) {
      if (f.kind < 0.38) {
        rosette(f.x, f.y, between(1.15, 1.5), 8, [C.ivory, C.rose], [[0.42, C.navy], [0.2, C.gold]], f.kind * 9);
      } else if (f.kind < 0.58) {
        rosette(f.x, f.y, between(1.0, 1.3), 6, [C.navy], [[0.4, C.ivory], [0.2, C.red]], f.kind * 7);
      } else if (f.kind < 0.74) {
        palmette(f.x, f.y, 1.9, Math.atan2(f.y, f.x), C.gold, C.navy);
      } else if (f.kind < 0.88) {
        const turn = f.kind * 40;
        leaf(f.x, f.y, 2.1, 0.62, turn, C.green, C.ivoryDeep);
        leaf(f.x, f.y, 1.8, 0.55, turn + 2.4, C.navy);
        circle(f.x, f.y, 0.5, C.gold);
      } else {
        star(f.x, f.y, 1.2, 0.5, 8, C.ivory, f.kind * 5);
        circle(f.x, f.y, 0.45, C.red);
      }
    }
  });

  // The corners: ivory spandrels, scalloped, with indigo inside them.
  four(cx, cy, () => {
    const arc = (rx, ry) => {
      const pts = [[hx + 2, hy + 2]];
      for (let k = 0; k <= 96; k++) {
        const phi = (k / 96) * (Math.PI / 2);
        const s = 1 + 0.075 * Math.abs(Math.sin(phi * 14));
        pts.push([hx - rx * s * Math.cos(phi), hy - ry * s * Math.sin(phi)]);
      }
      return pts;
    };
    shape(arc(15.5, 21.5));
    fill(C.ivory);
    shape(arc(15.5, 21.5));
    stroke(C.redDeep, 0.35);
    shape(arc(12.6, 18.4));
    fill(C.navy);
    // Flowers in the indigo, on an arc of vine.
    g.beginPath();
    g.ellipse(hx, hy, 8.2, 11.6, 0, Math.PI, Math.PI * 1.5);
    stroke(C.gold, 0.32);
    for (let k = 0; k < 3; k++) {
      const phi = (Math.PI / 2) * ((k + 0.5) / 3);
      const x = hx - 8.2 * Math.cos(phi);
      const y = hy - 11.6 * Math.sin(phi);
      rosette(x, y, 1.35, 8, [C.red, C.rose], [[0.4, C.ivory], [0.18, C.navy]], k);
      leaf(x, y, 2, 0.55, -phi - 0.6, C.green);
    }
    rosette(hx - 3.4, hy - 4.6, 1.8, 10, [C.rose, C.red], [[0.45, C.ivory], [0.24, C.red], [0.1, C.gold]]);
    // Small red flowers along the ivory.
    for (let k = 1; k < 9; k++) {
      const phi = (Math.PI / 2) * (k / 9);
      circle(hx - 14.1 * Math.cos(phi), hy - 19.9 * Math.sin(phi), 0.5, k % 2 ? C.red : C.navy);
    }
  });

  // The medallion: a lobed indigo diamond with a knob at each tip.
  const diamond = lobed(
    [
      [cx, cy - b],
      [cx + a, cy],
      [cx, cy + b],
      [cx - a, cy],
    ],
    5,
    1.7,
    cx,
    cy,
  );
  for (const [tx, ty] of [
    [cx, cy - b - 1.6],
    [cx + a + 1.6, cy],
    [cx, cy + b + 1.6],
    [cx - a - 1.6, cy],
  ]) {
    circle(tx, ty, 2.5, C.ivory);
    circle(tx, ty, 1.7, C.navy);
  }
  shape(diamond);
  fill(C.navy);
  stroke(C.ivory, 1);
  shape(inset(diamond, cx, cy, 1.4));
  stroke(C.redLight, 0.35);
  // Pendants on stems, along the rug's length.
  for (const sy of [1, -1]) {
    g.beginPath();
    g.moveTo(cx, cy + sy * (b + 3.6));
    g.lineTo(cx, cy + sy * (b + 6));
    stroke(C.ivory, 0.6);
    const py = cy + sy * (b + 10);
    const drop = lobed(
      [
        [cx, py - sy * 4.6],
        [cx + 3.6, py],
        [cx, py + sy * 4.6],
        [cx - 3.6, py],
      ],
      2,
      0.9,
      cx,
      py,
    );
    shape(drop);
    fill(C.navy);
    stroke(C.ivory, 0.6);
    rosette(cx, py, 1.6, 8, [C.red, C.rose], [[0.42, C.ivory], [0.2, C.red]]);
  }
  // And a small lozenge at either side.
  for (const sx of [1, -1]) {
    const px = cx + sx * (a + 6.5);
    shape([
      [px, cy - 4],
      [px + 2.7, cy],
      [px, cy + 4],
      [px - 2.7, cy],
    ]);
    fill(C.navy);
    stroke(C.ivory, 0.5);
    circle(px, cy, 0.9, C.ivory);
    circle(px, cy, 0.45, C.red);
  }
  // Flowers inside the medallion.
  const inMedallion = scatter(
    a,
    b,
    2.7,
    (x, y) => x > 1.6 && y > 1.6 && x / a + y / b < 0.84 && (x / 12) ** 2 + (y / 15) ** 2 > 1,
  );
  four(cx, cy, () => {
    vines(inMedallion, C.gold, 0.28);
    for (const p of inMedallion) {
      if (random() < 0.6) rosette(p.x, p.y, 1.05, 8, [C.red, C.rose], [[0.4, C.ivory], [0.18, C.gold]], p.x);
      else leaf(p.x, p.y, 2.1, 0.6, Math.atan2(p.y, p.x), C.ivory, C.gold);
    }
  });
  // The inner medallion, ivory, eight-lobed, and the flower at the heart.
  const heart = [];
  for (let k = 0; k < 160; k++) {
    const t = (k / 160) * TAU;
    const s = 1 + 0.09 * Math.cos(8 * t);
    heart.push([cx + 10.5 * s * Math.cos(t), cy + 13.5 * s * Math.sin(t)]);
  }
  shape(heart);
  fill(C.ivory);
  stroke(C.redDeep, 0.5);
  for (let k = 0; k < 8; k++) {
    const t = (k / 8) * TAU;
    leaf(cx + Math.cos(t) * 5.6, cy + Math.sin(t) * 7, 4, 1.1, t, k % 2 ? C.navy : C.red, k % 2 ? C.sky : C.rose);
  }
  rosette(cx, cy, 5.4, 16, [C.red, C.redDeep], [
    [0.52, C.ivory],
    [0.4, C.navy],
    [0.24, C.red],
    [0.1, C.gold],
  ]);

  // --- The borders, from the field out --------------------------------------
  /** Fills the band between two insets from the edge. */
  const band = (from, to, colour) => {
    g.beginPath();
    g.rect(from, from, W - 2 * from, H - 2 * from);
    g.rect(to, to, W - 2 * to, H - 2 * to);
    g.fillStyle = colour;
    g.fill('evenodd');
  };
  /** Points every `step` or so along the line `at` in from the edge, corners first, with which side each is on. */
  const along = (at, step) => {
    const pts = [];
    const sides = [
      [at, at, W - at, at],
      [W - at, at, W - at, H - at],
      [W - at, H - at, at, H - at],
      [at, H - at, at, at],
    ];
    for (const [x0, y0, x1, y1] of sides) {
      const length = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(length / step));
      for (let k = 0; k < n; k++) pts.push({ x: x0 + ((x1 - x0) * k) / n, y: y0 + ((y1 - y0) * k) / n, corner: k === 0, dx: (x1 - x0) / length, dy: (y1 - y0) / length, step: length / n });
    }
    return pts;
  };

  band(0, 1.1, C.binding);
  band(1.1, 1.7, C.ivory);
  band(1.7, 4.7, C.red);
  band(4.7, 5.3, C.ivory);
  band(5.3, 5.9, C.navyDeep);
  band(5.9, 16.1, C.navy);
  band(16.1, 16.7, C.ivory);
  band(16.7, 19.3, C.red);
  band(19.3, 19.9, C.ivory);
  band(19.9, 20.5, C.navy);

  // The outer guard: small ivory flowers and indigo dots, by turns.
  along(3.2, 2.6).forEach((p, i) => {
    if (i % 2) circle(p.x, p.y, 0.55, C.navy);
    else rosette(p.x, p.y, 1.05, 4, [C.ivory], [[0.3, C.red]], Math.PI / 4);
  });
  // The inner guard: ivory flowers with red hearts, indigo dots between.
  along(18, 2.8).forEach((p) => {
    rosette(p.x, p.y, 1.1, 4, [C.ivory], [[0.32, C.redDeep]]);
    circle(p.x + p.dx * 1.4, p.y + p.dy * 1.4, 0.35, C.navy);
  });
  // The main border: rosettes on a vine that winds between them.
  const main = along(11, 11.5);
  main.forEach((p, i) => {
    const nx = -p.dy;
    const ny = p.dx;
    // The vine, to the next rosette, a wave across the band.
    const q = { x: p.x + p.dx * p.step, y: p.y + p.dy * p.step };
    const swing = (i % 2 ? 1 : -1) * 2.8;
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.bezierCurveTo(
      p.x + p.dx * p.step * 0.33 + nx * swing,
      p.y + p.dy * p.step * 0.33 + ny * swing,
      p.x + p.dx * p.step * 0.66 - nx * swing,
      p.y + p.dy * p.step * 0.66 - ny * swing,
      q.x,
      q.y,
    );
    stroke(C.gold, 0.42);
    for (const [share, side] of [
      [0.3, 1],
      [0.7, -1],
    ]) {
      const lx = p.x + p.dx * p.step * share + nx * side * swing * 0.75;
      const ly = p.y + p.dy * p.step * share + ny * side * swing * 0.75;
      leaf(lx, ly, 2.2, 0.75, Math.atan2(p.dy, p.dx) + side * 0.9, side > 0 ? C.green : C.rose);
    }
    // Small flowers at the band's edges, between the rosettes.
    const mx = p.x + p.dx * p.step * 0.5;
    const my = p.y + p.dy * p.step * 0.5;
    circle(mx + nx * 3.7, my + ny * 3.7, 0.7, C.redLight);
    circle(mx - nx * 3.7, my - ny * 3.7, 0.7, C.redLight);
  });
  main.forEach((p, i) => {
    if (p.corner) {
      star(p.x, p.y, 4.5, 0.62, 8, C.ivory, Math.PI / 8);
      rosette(p.x, p.y, 3, 10, [C.red, C.rose], [[0.45, C.ivory], [0.22, C.navy]]);
    } else if (i % 2) {
      rosette(p.x, p.y, 3.6, 10, [C.rose, C.red], [[0.5, C.ivory], [0.34, C.red], [0.15, C.navy]]);
    } else {
      rosette(p.x, p.y, 3.4, 8, [C.ivory, C.ivoryDeep], [[0.48, C.red], [0.3, C.gold], [0.13, C.ivory]], Math.PI / 8);
    }
  });

  // Abrash: dye lots changing as the weaving went on, in bands across.
  for (let y = 0; y < H; ) {
    const h = between(2, 8);
    g.globalCompositeOperation = random() < 0.5 ? 'multiply' : 'screen';
    g.fillStyle = `rgb(${g.globalCompositeOperation === 'multiply' ? '205 200 195' : '40 34 30'})`;
    g.globalAlpha = between(0.08, 0.2);
    g.fillRect(0, y, W, h);
    y += h;
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // --- The fringe: the warp, two threads to a cell, knotted in fours --------
  for (const end of [-1, 1]) {
    const from = end < 0 ? 0 : H;
    for (let k = 0; k < W * 2; k++) {
      const x = (k + 0.5) / 2;
      const length = fringe * between(0.72, 0.98);
      const wave = between(-0.5, 0.5);
      const shade = Math.round(between(205, 232));
      g.beginPath();
      g.moveTo(x, from);
      g.quadraticCurveTo(x + wave, from + end * length * 0.5, x + wave * 0.4, from + end * length);
      stroke(`rgb(${shade} ${shade - 10} ${shade - 32})`, 0.32);
    }
    for (let k = 0; k < W / 2; k++) circle(k * 2 + 1, from + end * 0.75, 0.62, C.ivoryDeep);
  }

  return canvas.toDataURL('image/webp', 0.9);
}

const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
for (const [name, scale] of [
  ['rug.webp', SCALE],
  ['rug-small.webp', SMALL_SCALE],
]) {
  const picture = await page.evaluate(draw, { across: ACROSS, along: ALONG, fringe: FRINGE, scale });
  const bytes = Buffer.from(picture.slice(picture.indexOf(',') + 1), 'base64');
  writeFileSync(`${OUT}${name}`, bytes);
  console.log(`Wrote ${name} (${ACROSS * scale} by ${(ALONG + 2 * FRINGE) * scale}, ${Math.round(bytes.length / 1024)} KB) to src/assets/rug/`);
}
await browser.close();

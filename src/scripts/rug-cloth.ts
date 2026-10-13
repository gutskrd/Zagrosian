/**
 * The rug as cloth (rug-scene.ts): a grid of particles joined by constraints,
 * stepped with position-based dynamics (Verlet integration, then each
 * constraint nudged back towards its length, in many small steps, as in
 * Macklin et al., "Small Steps in Physics Simulation", 2019).
 *
 * - Neighbours keep their distance (the weave does not stretch), diagonals
 *   resist shearing, and particles two apart resist bending, so it folds in
 *   broad, heavy curves as a wool rug does, not in creases like silk.
 * - It falls under gravity through a little air, lands on the floor and grips
 *   it (friction), so it lies where it is put and slides only when pulled.
 * - Where it folds over itself, the upper layer is kept a rug's thickness
 *   above the lower one, so a fold lies on top instead of sinking through.
 * - One particle can be held: it then goes where it is led, and the rest
 *   follows. Let go, and it keeps the speed it was moving at.
 *
 * World units: the rug is 1 wide; y is up, the floor is y = 0.
 */

const GRAVITY = 7;
const SUBSTEPS = 8;
const AIR = 0.9985;
const THICKNESS = 0.012;
const FLOOR = THICKNESS / 2;
const FRICTION = 0.3;
/** Slower than this (units a substep) against a surface, and it stops. */
const STILL = 0.00004;

export class Cloth {
  readonly columns: number;
  readonly rows: number;
  readonly count: number;
  readonly spacing: number;
  readonly position: Float32Array;
  readonly normal: Float32Array;
  private readonly previous: Float32Array;
  private readonly free: Uint8Array;
  private readonly a: Uint16Array;
  private readonly b: Uint16Array;
  private readonly rest: Float32Array;
  private readonly stiffness: Float32Array;
  /** The floor's edges, inside which the rug is kept. */
  bounds = { left: -1, right: 1, top: -1, bottom: 1 };
  /** The particle held, or -1, and where it is being led. */
  held = -1;
  readonly target = new Float32Array(3);
  /** How far the fastest particle moved in the last step, start to end. */
  motion = 0;
  private before = new Float32Array(0);
  // Buckets for finding particles near each other.
  private cellOf = new Int32Array(0);
  private start = new Int32Array(0);
  private order = new Int32Array(0);
  private fill = new Int32Array(0);

  constructor(columns: number, rows: number) {
    this.columns = columns;
    this.rows = rows;
    this.count = columns * rows;
    this.spacing = 1 / (columns - 1);
    this.position = new Float32Array(this.count * 3);
    this.previous = new Float32Array(this.count * 3);
    this.normal = new Float32Array(this.count * 3);
    this.free = new Uint8Array(this.count).fill(1);

    const links: [number, number, number, number][] = [];
    const at = (c: number, r: number) => r * columns + c;
    const link = (c1: number, r1: number, c2: number, r2: number, k: number) => {
      if (c2 < 0 || c2 >= columns || r2 >= rows) return;
      links.push([at(c1, r1), at(c2, r2), this.spacing * Math.hypot(c2 - c1, r2 - r1), k]);
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        link(c, r, c + 1, r, 1);
        link(c, r, c, r + 1, 1);
        link(c, r, c + 1, r + 1, 0.5);
        link(c, r, c - 1, r + 1, 0.5);
        link(c, r, c + 2, r, 0.22);
        link(c, r, c, r + 2, 0.22);
      }
    }
    this.a = Uint16Array.from(links, (l) => l[0]);
    this.b = Uint16Array.from(links, (l) => l[1]);
    this.rest = Float32Array.from(links, (l) => l[2]);
    this.stiffness = Float32Array.from(links, (l) => l[3]);
  }

  /** Lays the rug out flat, centred on (x, z), turned by `angle`, `height` above the floor (rippled by `ripple`), still. */
  layFlat(x: number, z: number, angle: number, { height = 0, ripple = 0 } = {}) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const length = (this.rows - 1) * this.spacing;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        const i = (r * this.columns + c) * 3;
        const u = c * this.spacing - 0.5;
        const v = r * this.spacing - length / 2;
        this.position[i] = x + u * cos - v * sin;
        this.position[i + 1] = FLOOR + height + ripple * Math.sin(u * 5.2 + v * 2.1) * Math.sin(v * 3.3 + 0.7);
        this.position[i + 2] = z + u * sin + v * cos;
      }
    }
    this.previous.set(this.position);
    this.motion = 0;
    this.computeNormals();
  }

  /** Holds particle `i`; `null` lets go. */
  hold(i: number | null) {
    if (this.held >= 0) this.free[this.held] = 1;
    this.held = i ?? -1;
    if (this.held >= 0) {
      this.free[this.held] = 0;
      this.target.set(this.position.subarray(this.held * 3, this.held * 3 + 3));
    }
  }

  /** Lets go, moving at this velocity (units a second). */
  release(vx: number, vy: number, vz: number, dt: number) {
    const i = this.held;
    this.hold(null);
    if (i < 0) return;
    const h = dt / SUBSTEPS;
    this.previous[i * 3] = this.position[i * 3] - vx * h;
    this.previous[i * 3 + 1] = this.position[i * 3 + 1] - vy * h;
    this.previous[i * 3 + 2] = this.position[i * 3 + 2] - vz * h;
  }

  /** Advances the cloth by `dt` seconds. */
  step(dt: number) {
    const h = dt / SUBSTEPS;
    const p = this.position;
    const q = this.previous;
    if (this.before.length !== p.length) this.before = new Float32Array(p.length);
    this.before.set(p);
    for (let s = 0; s < SUBSTEPS; s++) {
      // Move: each particle keeps its velocity, slowed a little by the air,
      // and falls.
      for (let i = 0; i < this.count; i++) {
        if (!this.free[i]) continue;
        const k = i * 3;
        for (let d = 0; d < 3; d++) {
          const v = (p[k + d] - q[k + d]) * AIR;
          q[k + d] = p[k + d];
          p[k + d] += v;
        }
        p[k + 1] -= GRAVITY * h * h;
      }
      // The held particle goes where it is led, a substep's share at a time.
      if (this.held >= 0) {
        const k = this.held * 3;
        for (let d = 0; d < 3; d++) {
          q[k + d] = p[k + d];
          p[k + d] += (this.target[d] - p[k + d]) * (1 / (SUBSTEPS - s));
        }
      }
      this.solve();
      // Layers are kept apart every other substep, which is enough.
      if (s % 2) this.separateLayers();
      this.collide();
    }
    // What the eye sees: how far each particle got this step, not how it
    // trembled on the way.
    let motion = 0;
    for (let k = 0; k < this.count * 3; k++) motion = Math.max(motion, Math.abs(p[k] - this.before[k]));
    this.motion = motion;
    this.computeNormals();
  }

  /** Nudges every constraint back towards its length. */
  private solve() {
    const p = this.position;
    const { a, b, rest, stiffness, free } = this;
    for (let n = 0; n < a.length; n++) {
      const i = a[n] * 3;
      const j = b[n] * 3;
      const dx = p[j] - p[i];
      const dy = p[j + 1] - p[i + 1];
      const dz = p[j + 2] - p[i + 2];
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
      const wi = free[a[n]];
      const wj = free[b[n]];
      const w = wi + wj;
      if (!w) continue;
      let correction = ((length - rest[n]) / length) * stiffness[n];
      // Bending gives way more easily to being shortened (a fold) than to
      // being stretched.
      if (stiffness[n] < 0.3 && length < rest[n]) correction *= 0.35;
      const ci = (correction * wi) / w;
      const cj = (correction * wj) / w;
      p[i] += dx * ci;
      p[i + 1] += dy * ci;
      p[i + 2] += dz * ci;
      p[j] -= dx * cj;
      p[j + 1] -= dy * cj;
      p[j + 2] -= dz * cj;
    }
  }

  /**
   * Friction against what particle k lies on: much of its sideways movement
   * is lost, and if it was barely moving it stops (wool on wool, or on a
   * floor, does not creep).
   */
  private grip(k: number) {
    const p = this.position;
    const q = this.previous;
    const dx = p[k] - q[k];
    const dz = p[k + 2] - q[k + 2];
    if (dx * dx + dz * dz < STILL * STILL) {
      p[k] = q[k];
      p[k + 2] = q[k + 2];
    } else {
      p[k] -= dx * FRICTION;
      p[k + 2] -= dz * FRICTION;
    }
  }

  /** The floor, its friction, and the edges of the floor. */
  private collide() {
    const p = this.position;
    const { left, right, top, bottom } = this.bounds;
    for (let i = 0; i < this.count; i++) {
      if (!this.free[i]) continue;
      const k = i * 3;
      if (p[k + 1] < FLOOR) {
        p[k + 1] = FLOOR;
        this.grip(k);
      }
      if (p[k] < left) p[k] = left;
      else if (p[k] > right) p[k] = right;
      if (p[k + 2] < top) p[k + 2] = top;
      else if (p[k + 2] > bottom) p[k + 2] = bottom;
    }
  }

  /**
   * Where the rug lies over itself, keeps the upper layer a thickness above
   * the lower: particles near each other across the floor, but not neighbours
   * in the weave, are pushed apart upwards.
   */
  private separateLayers() {
    const p = this.position;
    const cell = this.spacing * 0.8;
    const { left, top } = this.bounds;
    const across = Math.ceil((this.bounds.right - left) / cell) + 1;
    const down = Math.ceil((this.bounds.bottom - top) / cell) + 1;
    const cells = across * down;
    if (this.start.length !== cells + 1) {
      this.start = new Int32Array(cells + 1);
      this.fill = new Int32Array(cells);
      this.cellOf = new Int32Array(this.count);
      this.order = new Int32Array(this.count);
    }
    const { start, cellOf, order } = this;
    start.fill(0);
    for (let i = 0; i < this.count; i++) {
      const cx = Math.min(across - 1, Math.max(0, Math.floor((p[i * 3] - left) / cell)));
      const cz = Math.min(down - 1, Math.max(0, Math.floor((p[i * 3 + 2] - top) / cell)));
      cellOf[i] = cz * across + cx;
      start[cellOf[i] + 1]++;
    }
    for (let c = 0; c < cells; c++) start[c + 1] += start[c];
    const fill = this.fill;
    fill.set(start.subarray(0, cells));
    for (let i = 0; i < this.count; i++) order[fill[cellOf[i]]++] = i;

    const reach = this.spacing * 0.75;
    for (let i = 0; i < this.count; i++) {
      const ci = i % this.columns;
      const ri = (i / this.columns) | 0;
      const cx = cellOf[i] % across;
      const cz = (cellOf[i] / across) | 0;
      for (let z = Math.max(0, cz - 1); z <= Math.min(down - 1, cz + 1); z++) {
        for (let x = Math.max(0, cx - 1); x <= Math.min(across - 1, cx + 1); x++) {
          const c = z * across + x;
          for (let n = start[c]; n < start[c + 1]; n++) {
            const j = order[n];
            if (j <= i) continue;
            if (Math.abs((j % this.columns) - ci) <= 2 && Math.abs(((j / this.columns) | 0) - ri) <= 2) continue;
            const dx = p[j * 3] - p[i * 3];
            const dz = p[j * 3 + 2] - p[i * 3 + 2];
            if (dx * dx + dz * dz > reach * reach) continue;
            const dy = p[j * 3 + 1] - p[i * 3 + 1];
            if (Math.abs(dy) >= THICKNESS) continue;
            // The higher one goes up, the lower down (the floor stops it).
            const push = (THICKNESS - Math.abs(dy)) / 2;
            const up = dy > 0 || (dy === 0 && j > i) ? j : i;
            const low = up === j ? i : j;
            if (this.free[up]) {
              p[up * 3 + 1] += push * (this.free[low] ? 1 : 2);
              // The upper layer rests on the lower: it grips it.
              this.grip(up * 3);
            }
            if (this.free[low]) p[low * 3 + 1] -= push * (this.free[up] ? 1 : 2);
          }
        }
      }
    }
  }

  /** Each particle's normal, from its neighbours. */
  computeNormals() {
    const p = this.position;
    const { columns, rows } = this;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const left = r * columns + Math.max(0, c - 1);
        const right = r * columns + Math.min(columns - 1, c + 1);
        const up = Math.max(0, r - 1) * columns + c;
        const down = Math.min(rows - 1, r + 1) * columns + c;
        const ax = p[right * 3] - p[left * 3];
        const ay = p[right * 3 + 1] - p[left * 3 + 1];
        const az = p[right * 3 + 2] - p[left * 3 + 2];
        const bx = p[down * 3] - p[up * 3];
        const by = p[down * 3 + 1] - p[up * 3 + 1];
        const bz = p[down * 3 + 2] - p[up * 3 + 2];
        // b × a points up for a rug lying face up.
        let nx = by * az - bz * ay;
        let ny = bz * ax - bx * az;
        let nz = bx * ay - by * ax;
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;
        const k = (r * columns + c) * 3;
        this.normal[k] = nx;
        this.normal[k + 1] = ny;
        this.normal[k + 2] = nz;
      }
    }
  }
}

export const RUG_THICKNESS = THICKNESS;

/**
 * Cloth simulation for the rug (scene.ts): a particle grid with distance constraints, solved
 * with position-based dynamics (Verlet integration plus constraint projection over many substeps;
 * Macklin et al., "Small Steps in Physics Simulation", 2019).
 *
 * - Structural constraints keep the weave from stretching, shear constraints resist skew, and bend
 *   constraints (particles two apart) produce broad, heavy folds like wool rather than sharp
 *   creases.
 * - Gravity with light air drag, a floor with friction: the rug stays where it's put and only
 *   slides when pulled.
 * - Self-collision keeps an upper layer one rug-thickness above the lower one, so folds rest on top
 *   instead of passing through.
 * - One particle can be pinned and driven; on release it keeps its velocity.
 *
 * Units: the rug is 1 wide; y is up and the floor is y = 0.
 */

// Tuned for heavy wool: drops quickly and damps fast (a swing is mostly gone within 0.5 s), so it
// never wobbles like rubber, with enough substeps that it never stretches either.
const GRAVITY = 8.5;
const SUBSTEPS = 10;
const AIR = 0.988;
const THICKNESS = 0.012;
const FLOOR = THICKNESS / 2;
const FRICTION = 0.3;
/** Velocity threshold (units per substep) below which a particle in contact comes to rest. */
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
  /** Floor bounds the rug is kept within. */
  bounds = { left: -1, right: 1, top: -1, bottom: 1 };
  /** Pinned particle index (-1 for none) and its target position. */
  held = -1;
  readonly target = new Float32Array(3);
  /** Max displacement of any particle over the last step. */
  motion = 0;
  /** Substeps per step: more is stiffer and more expensive. */
  readonly substeps: number;
  private before = new Float32Array(0);
  // Spatial hash buckets for neighbor queries.
  private cellOf = new Int32Array(0);
  private start = new Int32Array(0);
  private order = new Int32Array(0);
  private fill = new Int32Array(0);

  constructor(columns: number, rows: number, substeps = SUBSTEPS) {
    this.columns = columns;
    this.substeps = substeps;
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
        link(c, r, c + 2, r, 0.18);
        link(c, r, c, r + 2, 0.18);
      }
    }
    this.a = Uint16Array.from(links, (l) => l[0]);
    this.b = Uint16Array.from(links, (l) => l[1]);
    this.rest = Float32Array.from(links, (l) => l[2]);
    this.stiffness = Float32Array.from(links, (l) => l[3]);
  }

  /** Captures the full state for an exact `restore` later. */
  snapshot() {
    return { position: this.position.slice(), previous: this.previous.slice(), normal: this.normal.slice() };
  }

  restore(snapshot: ReturnType<Cloth['snapshot']>) {
    this.position.set(snapshot.position);
    this.previous.set(snapshot.previous);
    this.normal.set(snapshot.normal);
    this.motion = 0;
  }

  /**
   * Lays the rug flat and at rest, centered on (x, z), rotated by `angle`, `height` above the
   * floor, optionally rippled.
   */
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

  /** Pins particle `i`; `null` releases it. */
  hold(i: number | null) {
    if (this.held >= 0) this.free[this.held] = 1;
    this.held = i ?? -1;
    if (this.held >= 0) {
      this.free[this.held] = 0;
      this.target.set(this.position.subarray(this.held * 3, this.held * 3 + 3));
    }
  }

  /** Releases the pinned particle with the given velocity (units per second). */
  release(vx: number, vy: number, vz: number, dt: number) {
    const i = this.held;
    this.hold(null);
    if (i < 0) return;
    const h = dt / this.substeps;
    this.previous[i * 3] = this.position[i * 3] - vx * h;
    this.previous[i * 3 + 1] = this.position[i * 3 + 1] - vy * h;
    this.previous[i * 3 + 2] = this.position[i * 3 + 2] - vz * h;
  }

  /** Advances the simulation by `dt` seconds. */
  step(dt: number) {
    const h = dt / this.substeps;
    const p = this.position;
    const q = this.previous;
    if (this.before.length !== p.length) this.before = new Float32Array(p.length);
    this.before.set(p);
    for (let s = 0; s < this.substeps; s++) {
      // Integrate: keep velocity, apply air drag and gravity.
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
      // Move the pinned particle toward its target, one substep's share at a time.
      if (this.held >= 0) {
        const k = this.held * 3;
        for (let d = 0; d < 3; d++) {
          q[k + d] = p[k + d];
          p[k + d] += (this.target[d] - p[k + d]) * (1 / (this.substeps - s));
        }
      }
      this.solve();
      // Self-collision every other substep is sufficient.
      if (s % 2) this.separateLayers();
      this.collide();
    }
    // Visible motion: net displacement over the step, not jitter within it.
    let motion = 0;
    for (let k = 0; k < this.count * 3; k++) motion = Math.max(motion, Math.abs(p[k] - this.before[k]));
    this.motion = motion;
    this.computeNormals();
  }

  /** Projects every constraint toward its rest length. */
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
      // Bend constraints yield more to compression (folding) than to stretching.
      if (stiffness[n] < 0.3 && length < rest[n]) correction *= 0.3;
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
   * Contact friction: most tangential motion is lost, and slow particles stop entirely (wool on
   * wool or on a floor doesn't creep).
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

  /** Floor contact, friction and bounds. */
  private collide() {
    const p = this.position;
    const q = this.previous;
    const { left, right, top, bottom } = this.bounds;
    for (let i = 0; i < this.count; i++) {
      if (!this.free[i]) continue;
      const k = i * 3;
      if (p[k + 1] < FLOOR) {
        p[k + 1] = FLOOR;
        // Same as grip(), inlined: this runs for every particle on every substep.
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
      if (p[k] < left) p[k] = left;
      else if (p[k] > right) p[k] = right;
      if (p[k + 2] < top) p[k + 2] = top;
      else if (p[k + 2] > bottom) p[k + 2] = bottom;
    }
  }

  /**
   * Self-collision: where the rug overlaps itself, push nearby non-adjacent particles apart
   * vertically so the upper layer stays one thickness above the lower.
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
            // Split the correction: the upper particle moves up, the lower down (the floor stops
            // it).
            const push = (THICKNESS - Math.abs(dy)) / 2;
            const up = dy > 0 || (dy === 0 && j > i) ? j : i;
            const low = up === j ? i : j;
            if (this.free[up]) {
              p[up * 3 + 1] += push * (this.free[low] ? 1 : 2);
              // The upper layer rests on the lower and grips it.
              this.grip(up * 3);
            }
            if (this.free[low]) p[low * 3 + 1] -= push * (this.free[up] ? 1 : 2);
          }
        }
      }
    }
  }

  /** Per-particle normals from neighboring particles. */
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
        // b x a points up for a face-up rug.
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

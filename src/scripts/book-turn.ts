/**
 * Page-turn animation for the book reader (BookReader.astro, book.ts).
 *
 * A turn renders entirely in the leaves layer above the pages. While it runs, the real pages are
 * transparent (`data-turning`) but stay in the accessibility tree, which already points at the new
 * pages; what is visible are copies of their images. Under the leaf, the lift side shows the page
 * being revealed and the landing side keeps the page being covered until the leaf lands. Afterwards
 * the copies are removed and the real pages show the same images in the same place.
 *
 * In a spread the leaf rotates 180 degrees about the spine. In single-page mode it rotates 100
 * degrees about the page's left edge and fades past 90, so the whole motion stays on screen. A turn
 * takes 550 ms: the leaf lifts immediately, crosses and settles; its outer half curls up on lift,
 * leads across and trails on landing; a highlight runs along the fold, and the revealed page comes
 * out of the leaf's shadow. Only transform and opacity animate (Web Animations API), plus each
 * leaf's z-index, which changes once: leaves are 3D-rendered individually, so overlapping leaves
 * are ordered as flat layers, swapping at 90 degrees where the leaf is edge-on and the swap is
 * invisible.
 *
 * A turn can be paused at any point and driven by hand (drag, swipe, corner peek), then completed
 * or released: the reader computes the angle that keeps the page edge under the finger
 * (`progressForReach`). A turn waits at most 120 ms for images that haven't loaded (the reader
 * prefetches and decodes ahead) before starting anyway. Errors propagate to the caller, which falls
 * back to an instant page change.
 */

export const TURN_MS = 550;
/** Stagger between leaves in a multi-leaf (chapter) turn. */
export const LEAF_GAP_MS = 60;
type Ease = readonly [number, number, number, number];
/** Spread: immediate lift, cross, settle on landing. */
const LIFT_AND_SETTLE: Ease = [0.2, 0.7, 0.2, 1];
/**
 * Single page: also an immediate lift, but more evenly paced, since the whole motion is visible
 * before the leaf passes the edge.
 */
const LIFT_AND_GO: Ease = [0.25, 0.4, 0.3, 1];
const easeOf = (spread: boolean) => (spread ? LIFT_AND_SETTLE : LIFT_AND_GO);
/** Max time a turn waits for its images, in ms. */
const DECODE_WAIT = 120;

export type Direction = 'forward' | 'back';

/** Content of a leaf face: a page image, the closing card, blank paper, or nothing. */
export type Source = { img: HTMLImageElement } | { card: HTMLElement } | 'plain' | null;

export interface TurnSpec {
  direction: Direction;
  /** Two-page spread, or single-page mode. */
  spread: boolean;
  /** Leaves to turn, in lift order, with their front and back faces. */
  leaves: { front: Source; back: Source }[];
  /** Revealed underneath on the lift side: the new page. */
  reveal: Source;
  /** Kept on the landing side until the leaf lands: the old page. */
  hold: Source;
  /** Cover opening (the book glides from center to its resting position) or closing. */
  glide?: 'open' | 'close';
}

/** Rotation per leaf: 180 degrees in a spread, just past the edge (100) in single-page mode. */
const sweepOf = (spread: boolean) => (spread ? 180 : 100);

// --- Easing, forward and inverse ---

const bezier = (a: number, b: number, s: number) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s ** 2 * b + s ** 3;
/** Solves for the Bezier parameter at which a monotonic coordinate reaches `value`. */
const solve = (a: number, b: number, value: number) => {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    if (bezier(a, b, mid) < value) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};
/** Fraction of the turn's duration at which it reaches `progress`. */
const timeAt = (ease: Ease, progress: number) => bezier(ease[0], ease[2], solve(ease[1], ease[3], progress));
/** Progress of the turn at a fraction of its duration. */
const progressAt = (ease: Ease, time: number) => bezier(ease[1], ease[3], solve(ease[0], ease[2], time));

/** Progress of a leaf rotated by `degrees`. */
export const progressForAngle = (degrees: number, spread: boolean) => Math.min(1, Math.max(0, degrees / sweepOf(spread)));

/**
 * Progress at which a leaf's outer edge sits under a finger that has moved `reach` px from where it
 * grabbed the edge of a page `width` px wide. Seen from the front, an edge rotated by theta sits at
 * cos(theta) from the hinge.
 */
export const progressForReach = (reach: number, width: number, spread: boolean) =>
  progressForAngle((Math.acos(1 - Math.min(2, Math.max(0, reach) / Math.max(1, width))) * 180) / Math.PI, spread);

/**
 * Copy of a face's content, plus a promise that resolves once its image can be drawn (immediately
 * if already loaded).
 */
function copyOf(source: Source, className: string): { element: HTMLElement; ready: Promise<unknown> } | null {
  if (!source) return null;
  const page = document.createElement('div');
  page.className = className;
  if (source === 'plain') {
    page.classList.add('leaf__page--plain');
    return { element: page, ready: Promise.resolve() };
  }
  if ('card' in source) {
    page.classList.add('leaf__page--card');
    const card = source.card.cloneNode(true) as HTMLElement;
    for (const element of [card, ...card.querySelectorAll('[id]')]) element.removeAttribute('id');
    card.removeAttribute('data-shown');
    card.removeAttribute('data-book-end');
    page.append(card);
    return { element: page, ready: Promise.resolve() };
  }
  const img = source.img.cloneNode() as HTMLImageElement;
  img.removeAttribute('fetchpriority');
  img.loading = 'eager';
  // Already-loaded images render on the copy's first frame rather than a frame or two later.
  const fetched = source.img.complete && source.img.naturalWidth > 0;
  if (fetched) img.decoding = 'sync';
  page.append(img);
  return { element: page, ready: fetched ? Promise.resolve() : img.decode().catch(() => undefined) };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Owns a reader's leaves and in-progress turns. */
export class Turner {
  private readonly holds: Record<'left' | 'right', HTMLElement>;
  readonly cast: HTMLElement;
  private readonly active = new Set<Turn>();
  private free: HTMLElement[];
  private sequence = 0;

  constructor(
    private readonly root: HTMLElement,
    readonly spread: HTMLElement,
    layer: HTMLElement,
  ) {
    this.free = [...layer.querySelectorAll<HTMLElement>('[data-leaf]')];
    this.holds = {
      left: layer.querySelector<HTMLElement>('[data-hold="left"]')!,
      right: layer.querySelector<HTMLElement>('[data-hold="right"]')!,
    };
    this.cast = layer.querySelector<HTMLElement>('[data-book-cast]')!;
  }

  /** Whether a turn is in progress. */
  get busy() {
    return this.active.size > 0;
  }

  /** Whether a turn of this many leaves can start now. */
  canTurn(leaves: number) {
    return this.free.length >= leaves;
  }

  /** Stops every turn immediately. */
  stopAll() {
    for (const turn of [...this.active]) turn.stop();
  }

  /** Jumps every in-progress turn to its end, as if it had finished. */
  finishAll() {
    for (const turn of [...this.active]) turn.finish();
  }

  /**
   * Prepares a turn: inserts the copies and, unless `wait` is false, briefly waits for images not
   * yet on screen. Returns the turn hidden; `start` shows it at its beginning.
   */
  async prepare(spec: TurnSpec, options: { wait?: boolean } = {}) {
    if (!this.canTurn(spec.leaves.length)) throw new Error('No leaf is free');
    const leaves = this.free.splice(0, spec.leaves.length);
    const made: HTMLElement[] = [];
    const readies: Promise<unknown>[] = [];
    const lay = (into: HTMLElement, source: Source, className: string) => {
      const copy = copyOf(source, className);
      if (!copy) return;
      made.push(copy.element);
      readies.push(copy.ready);
      into.append(copy.element);
    };

    const forward = spec.direction === 'forward';
    // In single-page mode the only page position is the right-hand hold, over which the leaf lifts
    // or lands.
    const revealSide = spec.spread && !forward ? 'left' : 'right';
    const holdSide = spec.spread && forward ? 'left' : 'right';
    const hold = document.createElement('div');
    const reveal = document.createElement('div');
    hold.className = reveal.className = 'book__hold-stack';
    hold.hidden = reveal.hidden = true;
    made.push(hold, reveal);
    if (spec.spread || !forward) lay(hold, spec.hold, 'book__hold-page');
    if (spec.spread || forward) lay(reveal, spec.reveal, 'book__hold-page');
    // The landing side keeps its oldest page on top until each leaf lands; the lift side shows its
    // newest.
    this.holds[holdSide].prepend(hold);
    this.holds[revealSide].append(reveal);

    leaves.forEach((leaf, i) => {
      const { front, back } = spec.leaves[i]!;
      lay(leaf.querySelector('[data-face="inner-front"]')!, front, 'leaf__page');
      lay(leaf.querySelector('[data-face="outer-front"]')!, front, 'leaf__page');
      lay(leaf.querySelector('[data-face="inner-back"]')!, back, 'leaf__page');
      lay(leaf.querySelector('[data-face="outer-back"]')!, back, 'leaf__page');
    });

    if (options.wait !== false) await Promise.race([Promise.all(readies), wait(DECODE_WAIT)]);
    const order = leaves.map(() => ++this.sequence);
    return new Turn(this, spec, leaves, made, order);
  }

  /** @internal */
  begin(turn: Turn) {
    this.active.add(turn);
    this.root.toggleAttribute('data-turning', true);
  }

  /** @internal */
  end(turn: Turn, leaves: HTMLElement[], made: HTMLElement[]) {
    this.active.delete(turn);
    for (const element of made) element.remove();
    for (const leaf of leaves) leaf.removeAttribute('data-active');
    this.free.push(...leaves);
    if (this.active.size === 0) {
      this.root.removeAttribute('data-turning');
      this.cast.removeAttribute('data-side');
    }
  }
}

/** A single turn: its animations can play, be scrubbed by hand, finish or fall back. */
export class Turn {
  private animations: Animation[] = [];
  /**
   * Each leaf's rotation about its hinge. The last to land ends a turn; the first to return ends a
   * fall-back.
   */
  private turns: Animation[] = [];
  private settled = false;
  private falling = false;
  readonly done: Promise<'finished' | 'cancelled'>;
  private resolve!: (how: 'finished' | 'cancelled') => void;

  constructor(
    private readonly turner: Turner,
    private readonly spec: TurnSpec,
    private readonly leaves: HTMLElement[],
    private readonly made: HTMLElement[],
    private readonly order: number[],
  ) {
    this.done = new Promise((resolve) => (this.resolve = resolve));
  }

  /** Shows the turn paused at its start, with its animations ready to play or scrub. */
  start() {
    const { spec, leaves } = this;
    const forward = spec.direction === 'forward';
    const sweep = sweepOf(spec.spread);
    const [from, to] = forward ? [0, -sweep] : [-sweep, 0];
    // Outer half relative to the inner, in the turn direction: curls up on lift, leads across,
    // trails on landing. In single-page mode it curls more, crossing the edge still curled (or
    // arriving curled from beyond it) and flattening as it lands.
    const sign = forward ? -1 : 1;
    const [curl, at] = spec.spread
      ? [[0, 16, 24, -8, 0], [0, 0.12, 0.45, 0.85, 1]]
      : forward
        ? [[0, 22, 32, 30, 28], [0, 0.12, 0.45, 0.85, 1]]
        : [[28, 30, 32, 22, 0], [0, 0.15, 0.55, 0.88, 1]];
    const bend = curl.map((degrees, i) => ({ transform: `rotateY(${sign * degrees}deg)`, offset: at[i] }));
    // Progress at which the leaf is edge-on (90 degrees).
    const edge = 90 / sweep;
    this.turner.begin(this);
    for (const element of this.made) element.hidden = false;
    const easing = `cubic-bezier(${easeOf(spec.spread).join(', ')})`;
    const timing = (delay: number): KeyframeAnimationOptions => ({ duration: TURN_MS, delay, easing, fill: 'both' });

    leaves.forEach((leaf, i) => {
      const delay = i * LEAF_GAP_MS;
      leaf.toggleAttribute('data-active', true);
      const inner = leaf.querySelector<HTMLElement>('[data-leaf-inner]')!;
      const outer = leaf.querySelector<HTMLElement>('[data-leaf-outer]')!;
      const fold = leaf.querySelector<HTMLElement>('[data-leaf-fold]')!;
      // On top on the start side, below later leaves on the landing side; swapped while edge-on.
      const [before, after] = [String(1000 - this.order[i]!), String(1000 + this.order[i]!)];
      const turn = inner.animate([{ transform: `rotateY(${from}deg)` }, { transform: `rotateY(${to}deg)` }], timing(delay));
      this.turns.push(turn);
      this.animations.push(
        turn,
        outer.animate(bend, timing(delay)),
        fold.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.45 }, { opacity: 0 }], timing(delay)),
        leaf.animate(
          [
            { zIndex: before, offset: 0 },
            { zIndex: before, offset: edge - 0.001 },
            { zIndex: after, offset: edge },
            { zIndex: after, offset: 1 },
          ],
          timing(delay),
        ),
      );
      if (!spec.spread) {
        // Single-page mode: fade the whole leaf as it passes the page edge (or arrives from beyond
        // it). The leaf is already flattened, so its parts keep their depth order.
        const fade = forward
          ? [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
          : [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1 }];
        this.animations.push(leaf.animate(fade, timing(delay)));
      }
    });

    // The revealed page emerges from the leaf's shadow.
    const cast = this.turner.cast;
    cast.dataset.side = spec.spread && !forward ? 'left' : 'right';
    this.animations.push(cast.animate([{ opacity: 0.85 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }], timing(0)));

    if (spec.glide) {
      // Closed, the book shifts by half a page so the cover is centered.
      const half = this.turner.spread.offsetWidth / 4;
      const keyframes = [{ transform: `translateX(${-half}px)` }, { transform: 'translateX(0px)' }];
      if (spec.glide === 'close') keyframes.reverse();
      this.animations.push(this.turner.spread.animate(keyframes, { ...timing(0), duration: TURN_MS + (leaves.length - 1) * LEAF_GAP_MS }));
    }

    for (const animation of this.animations) animation.pause();
    this.turns.at(-1)!.addEventListener('finish', () => this.settle(this.falling ? 'cancelled' : 'finished'));
    this.turns[0]!.addEventListener('finish', () => {
      if (this.falling) this.settle('cancelled');
    });
  }

  /** Plays the turn to its end from its current position. */
  play() {
    this.falling = false;
    for (const animation of this.animations) {
      animation.playbackRate = 1;
      animation.play();
    }
  }

  /** Pauses the turn at `progress` (0-1), e.g. while dragging. */
  scrub(progress: number) {
    const time = timeAt(easeOf(this.spec.spread), Math.min(1, Math.max(0, progress))) * TURN_MS;
    for (const animation of this.animations) {
      animation.pause();
      animation.currentTime = time;
    }
  }

  /** Current progress, 0-1. */
  get progress() {
    const time = Number(this.turns[0]?.currentTime ?? 0);
    return progressAt(easeOf(this.spec.spread), Math.min(1, Math.max(0, time / TURN_MS)));
  }

  /** Reverts the turn to its start. */
  fallBack() {
    this.falling = true;
    if (this.progress === 0) return this.settle('cancelled');
    for (const animation of this.animations) {
      animation.playbackRate = -1.4;
      animation.play();
    }
  }

  /** Jumps to the end immediately; the pages land where the turn was taking them. */
  finish() {
    this.settle('finished');
  }

  /** Stops the turn immediately, wherever it is. */
  stop() {
    this.settle('cancelled');
  }

  private settle(how: 'finished' | 'cancelled') {
    if (this.settled) return;
    this.settled = true;
    for (const animation of this.animations) animation.cancel();
    this.turner.end(this, this.leaves, this.made);
    this.resolve(how);
  }
}

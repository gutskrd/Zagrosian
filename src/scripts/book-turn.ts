/**
 * Turning a leaf of Hevalo's book (the reader: BookReader.astro, book.ts).
 *
 * A turn is drawn entirely in the leaves layer, over the pages: while it
 * runs, the pages themselves are transparent (`data-turning`; still there
 * for assistive technology, which has already moved to the new pages) and
 * what is seen is copies of their pictures. Under the leaf, on the side it
 * lifts from, lies the page it uncovers; on the side it lands on, the page it
 * will cover stays until it does. Then the copies go and the real pages show,
 * the same pictures in the same places.
 *
 * Two pages open, the leaf turns about the spine, 180 degrees. One page at a
 * time it turns about the page's left edge, past standing on that edge to
 * 100 degrees, and fades as it goes over, so the whole of its movement is on
 * the screen, spread over most of the turn. It comes off the page at once,
 * crosses and settles, in 550 ms;
 * its outer piece curls up as it lifts, leads across and trails as it lands,
 * a light runs along the fold, and the page uncovered comes out of the
 * leaf's shadow. Only transform and opacity move (Web Animations), and each
 * leaf's stacking order, which changes once: each leaf is drawn in 3D on its
 * own, so leaves that overlap are ordered as flat layers, the one that lifted
 * first on top on the side they start from and under the others on the side
 * they land on, changing places at the moment it stands on its edge, where
 * it cannot be seen.
 *
 * A turn can also be held at any point and moved by hand (a drag, a swipe,
 * the corner lifting), then finished or let fall back: the reader asks for
 * the angle that keeps the page's edge under the finger (`progressForReach`),
 * and the turn is held at that angle. A turn waits at most 120 ms for the
 * pictures it needs that have not been fetched yet (the reader fetches and
 * decodes the next pages ahead) before it turns anyway; any failure in here
 * is the caller's to catch, and reading never waits for a leaf.
 */

export const TURN_MS = 550;
/** The leaves of a turn across a chapter follow each other this far apart. */
export const LEAF_GAP_MS = 60;
type Ease = readonly [number, number, number, number];
/** Two pages open: off the page at once, across, and settling as it lands. */
const LIFT_AND_SETTLE: Ease = [0.2, 0.7, 0.2, 1];
/** One page at a time: off at once too, but its way spread more evenly, as the whole of it is seen before it goes over the edge. */
const LIFT_AND_GO: Ease = [0.25, 0.4, 0.3, 1];
const easeOf = (spread: boolean) => (spread ? LIFT_AND_SETTLE : LIFT_AND_GO);
/** The longest a turn waits for its pictures. */
const DECODE_WAIT = 120;

export type Direction = 'forward' | 'back';

/** What a face shows: a page's picture, the closing card, plain paper, or nothing. */
export type Source = { img: HTMLImageElement } | { card: HTMLElement } | 'plain' | null;

export interface TurnSpec {
  direction: Direction;
  /** Two pages open (a spread), or one page at a time. */
  spread: boolean;
  /** Each leaf that turns, in the order they lift: what is on its front and on its back. */
  leaves: { front: Source; back: Source }[];
  /** What lies under the leaf on the side it lifts from: the new page uncovered. */
  reveal: Source;
  /** What stays on the side it lands on until it does: the old page covered. */
  hold: Source;
  /** The cover opening (the book glides from the middle to its place) or closing. */
  glide?: 'open' | 'close';
}

/** How far a leaf turns: over to the other side, or, one page at a time, just past its edge. */
const sweepOf = (spread: boolean) => (spread ? 180 : 100);

// ---- The easing, both ways --------------------------------------------------

const bezier = (a: number, b: number, s: number) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s ** 2 * b + s ** 3;
/** The curve's parameter at which one of its coordinates reaches a value (both rise steadily from 0 to 1). */
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
/** The share of a turn's time at which it is this far along its way. */
const timeAt = (ease: Ease, progress: number) => bezier(ease[0], ease[2], solve(ease[1], ease[3], progress));
/** How far along its way a turn is at this share of its time. */
const progressAt = (ease: Ease, time: number) => bezier(ease[1], ease[3], solve(ease[0], ease[2], time));

/** How far along its way a leaf is when it has turned this many degrees. */
export const progressForAngle = (degrees: number, spread: boolean) => Math.min(1, Math.max(0, degrees / sweepOf(spread)));

/**
 * How far along its way a leaf is when its outer edge is under a finger that
 * has moved `reach` pixels from where it took hold, at the edge of a page
 * `width` pixels wide: seen from in front, an edge turned by an angle stands
 * at the cosine of that angle from the hinge.
 */
export const progressForReach = (reach: number, width: number, spread: boolean) =>
  progressForAngle((Math.acos(1 - Math.min(2, Math.max(0, reach) / Math.max(1, width))) * 180) / Math.PI, spread);

/** A copy of what a face shows, and a promise kept once its picture is ready to be drawn (at once for a picture already fetched). */
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
  // a picture already fetched is drawn in the frame the copy first shows in, rather than a frame or two after it
  const fetched = source.img.complete && source.img.naturalWidth > 0;
  if (fetched) img.decoding = 'sync';
  page.append(img);
  return { element: page, ready: fetched ? Promise.resolve() : img.decode().catch(() => undefined) };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The leaves of one reader, and the turns under way. */
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

  /** Whether a turn is under way. */
  get busy() {
    return this.active.size > 0;
  }

  /** Whether a turn of this many leaves can start now. */
  canTurn(leaves: number) {
    return this.free.length >= leaves;
  }

  /** Ends every turn at once. */
  stopAll() {
    for (const turn of [...this.active]) turn.stop();
  }

  /** Brings every turn under way to its end at once, as if it had played out. */
  finishAll() {
    for (const turn of [...this.active]) turn.finish();
  }

  /**
   * Prepares a turn: lays the copies in and, unless told not to, waits a
   * moment for the pictures not on the screen yet. The turn is returned
   * unseen; `start` shows it held at its beginning.
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
    // One page at a time, the one place a page lies is the "right" hold, over which the leaf lifts or lands.
    const revealSide = spec.spread && !forward ? 'left' : 'right';
    const holdSide = spec.spread && forward ? 'left' : 'right';
    const hold = document.createElement('div');
    const reveal = document.createElement('div');
    hold.className = reveal.className = 'book__hold-stack';
    hold.hidden = reveal.hidden = true;
    made.push(hold, reveal);
    if (spec.spread || !forward) lay(hold, spec.hold, 'book__hold-page');
    if (spec.spread || forward) lay(reveal, spec.reveal, 'book__hold-page');
    // the side landed on keeps its oldest page on top until each leaf lands; the side uncovered shows its newest
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

/** One turn: its animations, which can play, be moved by hand, finish or fall back. */
export class Turn {
  private animations: Animation[] = [];
  /** Each leaf's turn about its hinge: the last to land ends the turn, the first to come back ends a fall back. */
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

  /** Shows the turn, held at its start, with its animations ready to play or to be moved by hand. */
  start() {
    const { spec, leaves } = this;
    const forward = spec.direction === 'forward';
    const sweep = sweepOf(spec.spread);
    const [from, to] = forward ? [0, -sweep] : [-sweep, 0];
    // The outer piece, against the inner, in the direction the leaf goes: it curls up as the leaf lifts, leads it
    // across and trails as it lands. One page at a time it curls harder, and goes over the edge still curled, or
    // comes in curled from beyond it and lies flat as it lands.
    const sign = forward ? -1 : 1;
    const [curl, at] = spec.spread
      ? [[0, 16, 24, -8, 0], [0, 0.12, 0.45, 0.85, 1]]
      : forward
        ? [[0, 22, 32, 30, 28], [0, 0.12, 0.45, 0.85, 1]]
        : [[28, 30, 32, 22, 0], [0, 0.15, 0.55, 0.88, 1]];
    const bend = curl.map((degrees, i) => ({ transform: `rotateY(${sign * degrees}deg)`, offset: at[i] }));
    // where the leaf stands on its edge, as a share of its way
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
      // on top where it starts, under the later leaves where it lands: the change falls when it stands on its edge
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
        // one page at a time, the leaf fades as it goes over the page's edge, or comes from beyond it (the leaf as a
        // whole, drawn flat already, so its pieces keep their depth)
        const fade = forward
          ? [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
          : [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1 }];
        this.animations.push(leaf.animate(fade, timing(delay)));
      }
    });

    // the page uncovered comes out of the leaf's shadow
    const cast = this.turner.cast;
    cast.dataset.side = spec.spread && !forward ? 'left' : 'right';
    this.animations.push(cast.animate([{ opacity: 0.85 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }], timing(0)));

    if (spec.glide) {
      // closed, the book is shifted by half a page so the cover lies in the middle
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

  /** Plays the turn to its end, from wherever it is. */
  play() {
    this.falling = false;
    for (const animation of this.animations) {
      animation.playbackRate = 1;
      animation.play();
    }
  }

  /** Holds the turn at a point of its way, from 0 to 1 (a drag): the leaf turned that share of its way. */
  scrub(progress: number) {
    const time = timeAt(easeOf(this.spec.spread), Math.min(1, Math.max(0, progress))) * TURN_MS;
    for (const animation of this.animations) {
      animation.pause();
      animation.currentTime = time;
    }
  }

  /** How far along its way the turn is, from 0 to 1. */
  get progress() {
    const time = Number(this.turns[0]?.currentTime ?? 0);
    return progressAt(easeOf(this.spec.spread), Math.min(1, Math.max(0, time / TURN_MS)));
  }

  /** Lets the turn fall back to where it started. */
  fallBack() {
    this.falling = true;
    if (this.progress === 0) return this.settle('cancelled');
    for (const animation of this.animations) {
      animation.playbackRate = -1.4;
      animation.play();
    }
  }

  /** Brings the turn to its end at once: the pages are where it was taking them. */
  finish() {
    this.settle('finished');
  }

  /** Ends the turn at once, wherever it is. */
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

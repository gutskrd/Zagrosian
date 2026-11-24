/**
 * Zoom for the book reader (index.ts): 1x, 1.5x, 2x and 3x. The pages are laid out larger inside
 * the stage, which then scrolls, so panning is native scrolling (wheel, trackpad, touch, arrow
 * keys); a mouse can also drag. The zoom anchor stays fixed, the zoom persists across page turns
 * (each new page starts at its top left), and images get updated `sizes` so the sharper candidate
 * loads. Browser pinch-zoom is never intercepted.
 */

const ZOOM_LEVELS = [1, 1.5, 2, 3] as const;

export class Zoom {
  level = 1;
  private readonly sizes = new WeakMap<HTMLImageElement, string>();
  private pan: { x: number; y: number; left: number; top: number; id: number; moved: boolean } | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly stage: HTMLElement,
    private readonly spread: HTMLElement,
    private readonly onChange: (level: number) => void,
  ) {
    stage.addEventListener('pointerdown', (event) => this.pointerDown(event));
    stage.addEventListener('pointermove', (event) => this.pointerMove(event));
    stage.addEventListener('pointerup', () => this.pointerUp());
    stage.addEventListener('pointercancel', () => this.pointerUp());
  }

  /** Whether a drag-to-pan just ended, so the following click is ignored. */
  get panned() {
    return this.pan?.moved ?? false;
  }

  zoomIn(at?: { x: number; y: number }) {
    const next = ZOOM_LEVELS.find((level) => level > this.level);
    if (next) this.set(next, at);
  }

  zoomOut(at?: { x: number; y: number }) {
    const next = [...ZOOM_LEVELS].reverse().find((level) => level < this.level);
    if (next) this.set(next, at);
  }

  fit() {
    this.set(1);
  }

  /**
   * Whether the zoomed page is scrolled fully toward `side`, so a tap or swipe there turns the
   * page.
   */
  atEdge(side: 'left' | 'right') {
    const { scrollLeft, scrollWidth, clientWidth } = this.stage;
    return side === 'left' ? scrollLeft <= 1 : scrollLeft + clientWidth >= scrollWidth - 1;
  }

  /** While zoomed, show a new page from its top left. */
  toStart() {
    this.stage.scrollTo(0, 0);
    this.sharpen();
  }

  /** Sets the zoom level, keeping the viewport point `at` (default: the stage's center) fixed. */
  set(level: number, at?: { x: number; y: number }) {
    if (level === this.level) return;
    const stageBox = this.stage.getBoundingClientRect();
    const point = at ?? { x: stageBox.left + stageBox.width / 2, y: stageBox.top + stageBox.height / 2 };
    const before = this.spread.getBoundingClientRect();
    const rx = (point.x - before.left) / before.width;
    const ry = (point.y - before.top) / before.height;

    this.level = level;
    this.root.toggleAttribute('data-zoom', level > 1);
    if (level > 1) this.stage.style.setProperty('--zoom', String(level));
    else this.stage.style.removeProperty('--zoom');

    const after = this.spread.getBoundingClientRect();
    if (level > 1) {
      this.stage.scrollLeft += after.left + rx * after.width - point.x;
      this.stage.scrollTop += after.top + ry * after.height - point.y;
    } else {
      this.stage.scrollTo(0, 0);
    }
    this.sharpen();
    this.onChange(level);
  }

  /**
   * Updates `sizes` on the visible images to their rendered width, so a zoomed page loads its
   * sharper source.
   */
  sharpen() {
    const width = this.spread.getBoundingClientRect().height * 0.70476;
    for (const img of this.root.querySelectorAll<HTMLImageElement>('.book__page[data-shown] img')) {
      if (!this.sizes.has(img)) this.sizes.set(img, img.sizes);
      img.sizes = this.level > 1 ? `${Math.ceil(width)}px` : this.sizes.get(img)!;
    }
  }

  private pointerDown(event: PointerEvent) {
    this.pan = null;
    if (this.level === 1 || event.pointerType !== 'mouse' || event.button !== 0) return;
    this.pan = {
      x: event.clientX,
      y: event.clientY,
      left: this.stage.scrollLeft,
      top: this.stage.scrollTop,
      id: event.pointerId,
      moved: false,
    };
  }

  private pointerMove(event: PointerEvent) {
    const pan = this.pan;
    if (!pan || event.pointerId !== pan.id || this.level === 1) return;
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 4) return;
    if (!pan.moved) {
      pan.moved = true;
      this.stage.setPointerCapture(event.pointerId);
      this.stage.toggleAttribute('data-panning', true);
    }
    this.stage.scrollLeft = pan.left - dx;
    this.stage.scrollTop = pan.top - dy;
  }

  private pointerUp() {
    this.stage.removeAttribute('data-panning');
    // Clear the pan flag after the click that ends it has been handled.
    const pan = this.pan;
    setTimeout(() => {
      if (this.pan === pan) this.pan = null;
    }, 0);
  }
}

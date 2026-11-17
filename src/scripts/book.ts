/**
 * The reader of Hevalo's book (BookReader.astro): which pages are open, and
 * every way to go from one to the next.
 *
 * - What is shown: the cover alone, then two pages side by side or one at a
 *   time, as the stylesheet decides from the room there is (`--book-spread`,
 *   read here on load and whenever the stage changes size). Only the pages
 *   open are displayed (`data-shown`), so a screen reader is on them alone,
 *   and the pictures of the next pages are fetched and decoded once these
 *   are in, so the next turn need not wait for them.
 * - Turning: the arrows under the book, the arrow keys (also while nothing
 *   else has the focus and the book is in view), Page Up and Down and the
 *   space bar, a sideways swipe on a trackpad, a click on a page, a tap at
 *   its edge, or the page drawn across by hand, its edge kept under the
 *   finger (book-turn.ts draws the leaf). Clicks in quick succession each
 *   count. [ and ] and the contents go from chapter to chapter, a few leaves
 *   at once; the slider goes straight there. With reduced motion, zoomed in
 *   or reading a column, pages change at once; zoomed in, the zoom stays, and
 *   a tap at the edge or a swipe beyond it turns the page once the page is
 *   scrolled to that edge.
 * - The book as one column to scroll: its pages, one under the other (the
 *   scroll view), or its words (the text view), with the bars following the
 *   page being read; full view: the book over the window; zoom (book-zoom.ts).
 * - The address follows the page (#page-12), without filling the history, so
 *   Back leaves the book; an address with #page-N or #chapter-N opens there.
 * - Numbers are written in the page's own digits, as the build wrote them
 *   (`data-digits`), whatever the browser's own formats know.
 *
 * Reading never waits for the leaves: a turn waits at most 120 ms for its
 * pictures, and if anything about turning fails, the page simply changes. A
 * control that cannot be used for the moment (Next on the last page) says so
 * (`aria-disabled`) but keeps the focus. If the reader cannot be set up at
 * all, the page goes back to the column of pages it shows without JavaScript
 * (`data-book="off"`).
 *
 * No HTML is made here: elements are copied or built with the DOM API, and
 * styles are set through the CSSOM.
 */
import { Turner, progressForAngle, progressForReach, type Direction, type Source, type Turn, type TurnSpec } from './book-turn';
import { Zoom } from './book-zoom';
import { play } from './sound';

type Item = number | 'end';
type View = Item[];
/** What a column of the book holds: its pages as pictures (the scroll view), or its words (the text view). */
type ColumnKind = 'pages' | 'text';

/** Turns asked for one after another start this far apart, so no more than three leaves are ever in the air. */
const CHAIN_MS = 190;
/** The most turns that wait their turn: every quick click counts, and a flurry does not run on for long. */
const MAX_PENDING = 8;
/** How far, in pixels, a press must move sideways to become a drag. */
const DRAG_START = 8;
/** How long the touch screen's hint stays once the book is in view. */
const HINT_MS = 4500;
/** How far the corner lifts to meet the mouse, in degrees. */
const PEEK_DEGREES = 20;

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

/** Whether a popover or a dialog is open over the page. */
const somethingOpen = () => {
  try {
    return document.querySelector(':popover-open, dialog[open]') !== null;
  } catch {
    return document.querySelector('dialog[open]') !== null;
  }
};

export function initBook() {
  const root = document.querySelector<HTMLElement>('[data-book]');
  if (!root) return;
  try {
    setUp(root);
  } catch {
    // The column of pages, as without JavaScript: everything is still there to read.
    root.dataset.book = 'off';
  }
}

function setUp(root: HTMLElement) {
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const body = $<HTMLElement>('.book__body');
  const stage = $<HTMLElement>('[data-book-stage]');
  const spread = $<HTMLElement>('[data-book-spread]');
  const pageList = $<HTMLOListElement>('[data-book-pages]');
  const endCard = $<HTMLElement>('[data-book-end]');
  const range = $<HTMLInputElement>('[data-book-range]');
  const scrub = $<HTMLElement>('[data-book-scrub]');
  const bubble = $<HTMLElement>('[data-book-bubble]');
  const counterShort = $<HTMLElement>('[data-book-counter-short]');
  const counterLong = $<HTMLElement>('[data-book-counter-long]');
  const where = $<HTMLElement>('[data-book-where]');
  const status = $<HTMLElement>('[data-book-status]');
  const prevButton = $<HTMLButtonElement>('[data-book-prev]');
  const nextButton = $<HTMLButtonElement>('[data-book-next]');
  const textButton = $<HTMLButtonElement>('[data-book-text-toggle]');
  const scrollButton = $<HTMLButtonElement>('[data-book-scroll-toggle]');
  const fullButton = $<HTMLButtonElement>('[data-book-full-toggle]');
  const zoomButtons = {
    in: $<HTMLButtonElement>('[data-book-zoom="in"]'),
    out: $<HTMLButtonElement>('[data-book-zoom="out"]'),
    fit: $<HTMLButtonElement>('[data-book-zoom="fit"]'),
  };
  const hint = $<HTMLElement>('[data-book-hint]');
  const notice = $<HTMLElement>('[data-book-notice]');
  const menu = $<HTMLElement>('#book-contents');
  const leavesLayer = $<HTMLElement>('[data-book-leaves]');

  const pages = [...pageList.querySelectorAll<HTMLLIElement>(':scope > .book__page')];
  const pageCount = pages.length;
  const pageOf = (n: number) => pages[n - 1]!;
  // the page's own digits, as the build wrote them: "٤١" in Sorani wherever the browser would write "41"
  const digits = [...(root.dataset.digits ?? '0123456789')];
  const n = (value: number) => String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
  const chapterLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-book-chapter]')];
  const chapterStarts = [...new Set(chapterLinks.map((link) => Number(link.dataset.start)))].sort((a, b) => a - b);

  const turner = new Turner(root, spread, leavesLayer);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine) and (hover: hover)');
  const touch = matchMedia('(hover: none) and (pointer: coarse)');

  /** A control that cannot be used for the moment, which keeps the focus if it has it. */
  const setDisabled = (button: HTMLElement, off: boolean) => {
    if (off) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
  };
  const usable = (button: HTMLElement) => button.getAttribute('aria-disabled') !== 'true';

  // ---- Views ---------------------------------------------------------------

  const readSpread = () => getComputedStyle(spread).getPropertyValue('--book-spread').trim() === '1';
  const viewsFor = (two: boolean): View[] => {
    if (!two) return [...pages.map((_, i) => [i + 1]), ['end']];
    const list: View[] = [[1]];
    for (let p = 2; p <= pageCount; p += 2) list.push(p + 1 <= pageCount ? [p, p + 1] : [p, 'end']);
    if (pageCount % 2 === 1) list.push(['end']);
    return list;
  };

  let twoPages = readSpread();
  let views = viewsFor(twoPages);
  let index = 0;
  /** The latest request to go somewhere, and where it goes: the book is heading there, even while its leaves are readied. */
  let requests = 0;
  let heading = 0;
  let shown = new Set<HTMLElement>([pageOf(1)]);
  /** Whether the book is read as one column to scroll (its pages or its words) rather than turned. */
  let column = false;
  let columnKind: ColumnKind = 'pages';
  /** In a column, the page being read: the last whose top is above the middle of the window. */
  let reading = 1;
  let anyTurn = false;

  const firstPage = (view: View) => (typeof view[0] === 'number' ? view[0] : pageCount + 1);
  const viewIndexOf = (page: number) => {
    const found = views.findIndex((view) => view.includes(page));
    return found < 0 ? views.length - 1 : found;
  };
  const itemElement = (item: Item) => (item === 'end' ? endCard : pageOf(item));
  const imgOf = (page: number) => pageOf(page).querySelector('img')!;
  const sourceOf = (item: Item | undefined): Source => (item === undefined ? null : item === 'end' ? { card: endCard } : { img: imgOf(item) });
  const sides = (view: View) => {
    if (!twoPages) return { left: undefined, right: view[0] };
    if (view.length === 1) return view[0] === 1 ? { left: undefined, right: 1 as Item } : { left: view[0], right: undefined };
    return { left: view[0], right: view[1] };
  };

  // ---- Words ---------------------------------------------------------------

  const zoomControls = () => {
    setDisabled(zoomButtons.out, column || zoom.level === 1);
    setDisabled(zoomButtons.fit, column || zoom.level === 1);
    setDisabled(zoomButtons.in, column || zoom.level === 3);
  };
  const zoom = new Zoom(root, stage, spread, () => {
    zoomControls();
    hideHint();
  });

  const labelOf = (view: View) => {
    const page = typeof view[0] === 'number' ? view[0] : pageCount;
    return pageOf(page).dataset.label || root.dataset.coverLabel || '';
  };
  const counterText = (view: View, short: boolean) => {
    const numbers = view.filter((item): item is number => typeof item === 'number');
    const total = n(pageCount);
    if (numbers.length === 0) return root.dataset.endTitle ?? '';
    if (short) return fill(root.dataset.counterShort ?? '', { a: n(numbers[0]!), total });
    if (numbers.length === 2) return fill(root.dataset.counterSpread ?? '', { a: n(numbers[0]!), b: n(numbers[1]!), total });
    return fill(root.dataset.counterPage ?? '', { a: n(numbers[0]!), total });
  };
  const statusText = (view: View) => {
    if (!view.some((item) => typeof item === 'number')) return root.dataset.endTitle ?? '';
    return fill(root.dataset.status ?? '', { where: counterText(view, false), chapter: labelOf(view) });
  };

  let announce: number | undefined;
  /** The bars say where the reader is: the pages open, or in a column the page being read. */
  const describe = () => {
    const view: View = column ? [reading] : views[index]!;
    // both, written out and short: the stylesheet shows the one the width has room for
    counterShort.textContent = counterText(view, true);
    counterLong.textContent = counterText(view, false);
    const first = typeof view[0] === 'number' ? pageOf(view[0]) : pageOf(pageCount);
    // two pages whose right one opens a chapter are where that chapter begins, so the bar and the contents name it, not the one ending on the left
    const right = view[1];
    const lead = typeof right === 'number' && chapterLinks.some((link) => Number(link.dataset.start) === right) ? pageOf(right) : first;
    where.textContent = lead.dataset.short || root.dataset.coverLabel || '';
    const at = column ? viewIndexOf(reading) : index;
    range.min = twoPages ? '0' : '1';
    range.max = String(twoPages ? views.length - 1 : views.length);
    range.value = String(twoPages ? at : at + 1);
    range.setAttribute('aria-valuetext', statusText(view));
    setDisabled(prevButton, column ? reading === 1 : index === 0);
    setDisabled(nextButton, column ? reading === pageCount : index === views.length - 1);
    const chapter = Number(lead.dataset.chapter ?? 0);
    for (const link of chapterLinks) {
      if (Number(link.dataset.bookChapter) === chapter) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    window.clearTimeout(announce);
    // in a column the pages themselves are read on; turning pages, where they went is said
    if (!column) announce = window.setTimeout(() => (status.textContent = statusText(views[index]!)), 500);
  };

  // ---- Showing a view ------------------------------------------------------------

  /** Moves the pages themselves to a view: what assistive technology follows. */
  const show = (to: number, options: { address?: boolean } = {}) => {
    index = Math.max(0, Math.min(views.length - 1, to));
    heading = index;
    const view = views[index]!;
    const next = new Set<HTMLElement>(view.map(itemElement));
    for (const element of shown) if (!next.has(element)) element.removeAttribute('data-shown');
    for (const element of next) element.toggleAttribute('data-shown', true);
    shown = next;
    root.toggleAttribute('data-closed', twoPages && index === 0);
    spread.style.setProperty('--read', String(Math.min(1, (firstPage(view) - 1) / Math.max(1, pageCount - 1))));
    if (zoom.level > 1) zoom.sharpen();
    describe();
    if (options.address !== false) address();
    prefetch();
  };

  /** The address follows the page (the left one of two, or the one being read), without adding to the history; the cover has none. */
  const address = () => {
    const page = column ? reading : firstPage(views[index]!);
    const hash = !column && index === 0 ? '' : `#page-${Math.min(page, pageCount)}`;
    if (location.hash === hash) return;
    try {
      history.replaceState(history.state, '', hash || `${location.pathname}${location.search}`);
    } catch {
      // Some browsers limit how often the address may change; the page still turns.
    }
  };

  /**
   * Once the open pages are in, the next two views and the one before are
   * fetched (the next only, to save data), and the pictures the next turn
   * either way shows are decoded, so it can start in the frame it is asked for.
   */
  let prefetched = -1;
  const prefetch = () => {
    const at = index;
    const images = views[at]!.filter((item): item is number => typeof item === 'number').map(imgOf);
    void Promise.all(images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined)))).then(() => {
      if (at !== index || prefetched === at) return;
      prefetched = at;
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
      const near = saveData ? [at + 1] : [at + 1, at + 2, at - 1];
      for (const i of near) {
        for (const item of views[i] ?? []) {
          if (item === 'end') continue;
          const img = imgOf(item);
          if (saveData) img.sizes = '1px';
          img.loading = 'eager';
          if (i === at + 1 || i === at - 1) void img.decode().catch(() => undefined);
        }
      }
    });
  };

  // ---- Turning ---------------------------------------------------------------

  const leafMotion = () => !reduceMotion.matches && zoom.level === 1 && !column;

  /** The leaves for a turn from one view to another: one, or three for a chapter away. */
  const specFor = (from: number, to: number, leaves: 1 | 3): TurnSpec => {
    const direction: Direction = to > from ? 'forward' : 'back';
    const a = sides(views[from]!);
    const b = sides(views[to]!);
    const plain = { front: 'plain' as Source, back: 'plain' as Source };
    if (!twoPages) {
      const current = sourceOf(views[from]![0]);
      const target = sourceOf(views[to]![0]);
      if (direction === 'forward') {
        const list = [{ front: current, back: 'plain' as Source }, plain, plain].slice(0, leaves);
        return { direction, spread: false, leaves: list, reveal: target, hold: null };
      }
      const list = leaves === 1 ? [{ front: target, back: 'plain' as Source }] : [plain, plain, { front: target, back: 'plain' as Source }];
      return { direction, spread: false, leaves: list, reveal: null, hold: current };
    }
    if (direction === 'forward') {
      const list =
        leaves === 1
          ? [{ front: sourceOf(a.right), back: sourceOf(b.left) }]
          : [{ front: sourceOf(a.right), back: 'plain' as Source }, plain, { front: 'plain' as Source, back: sourceOf(b.left) }];
      return { direction, spread: true, leaves: list, reveal: sourceOf(b.right), hold: sourceOf(a.left), glide: from === 0 ? 'open' : undefined };
    }
    const list =
      leaves === 1
        ? [{ front: sourceOf(b.right), back: sourceOf(a.left) }]
        : [{ front: 'plain' as Source, back: sourceOf(a.left) }, plain, { front: sourceOf(b.right), back: 'plain' as Source }];
    return { direction, spread: true, leaves: list, reveal: sourceOf(b.left), hold: sourceOf(a.right), glide: to === 0 ? 'close' : undefined };
  };

  const firstTurn = () => {
    hideHint();
    anyTurn = true;
  };

  let lastStart = -Infinity;
  /** Turns asked for and still to come: one page on (positive) or back (negative) for each. */
  let pending = 0;
  let queued: number | undefined;

  /** Goes to a view: with a leaf (or a few), or at once. The latest request wins. */
  const go = async (to: number, how: 'turn' | 'chapter' | 'instant' = 'turn') => {
    to = Math.max(0, Math.min(views.length - 1, to));
    const id = ++requests;
    heading = to;
    if (to === index) return;
    firstTurn();
    if (how === 'instant' || !leafMotion()) {
      turner.stopAll();
      show(to);
      // zoomed in, the zoom stays: the new page is read from its top left
      if (zoom.level > 1) zoom.toStart();
      return;
    }
    const from = index;
    const leaves = how === 'chapter' && Math.abs(to - from) > 1 ? 3 : 1;
    if (leaves === 3 || !turner.canTurn(leaves)) turner.finishAll();
    lastStart = performance.now();
    try {
      const turn = await turner.prepare(specFor(from, to, leaves));
      if (id !== requests || index !== from) {
        // a later request, or something else, moved the book while the pictures were readied
        turn.stop();
        return;
      }
      show(to);
      turn.start();
      turn.play();
      play('page');
    } catch {
      turner.stopAll();
      show(to);
    }
  };

  const cancelQueue = () => {
    window.clearTimeout(queued);
    queued = undefined;
    pending = 0;
  };

  /** Starts the turns that wait, one after another, as far apart as the leaves allow. */
  const runQueue = () => {
    if (queued !== undefined) return;
    queued = window.setTimeout(
      () => {
        queued = undefined;
        if (pending === 0) return;
        const by = Math.sign(pending);
        pending -= by;
        void go(heading + by);
        if (pending !== 0) runQueue();
      },
      Math.max(0, lastStart + CHAIN_MS - performance.now()),
    );
  };

  /**
   * One page on or back. Asked for while a turn has just started, it waits
   * its turn: each click counts, while a key held down waits for the leaves,
   * so the book stops when the key is let go.
   */
  const step = (by: 1 | -1, repeat = false) => {
    if (column) return columnStep(by);
    if (!leafMotion()) {
      cancelQueue();
      void go(heading + by);
      return;
    }
    // turning the other way, the turns that waited are let go
    if (pending !== 0 && Math.sign(pending) !== by) pending = 0;
    if (repeat && pending !== 0) return;
    if (pending === 0 && performance.now() - lastStart >= CHAIN_MS) {
      void go(heading + by);
      return;
    }
    pending = Math.max(-MAX_PENDING, Math.min(MAX_PENDING, pending + by));
    runQueue();
  };

  /** To the next chapter's opening, or the one before, from where the book is heading (or, in a column, the page being read). */
  const chapterStep = (by: 1 | -1) => {
    cancelQueue();
    if (column) {
      const target = by === 1 ? chapterStarts.find((start) => start > reading) : [...chapterStarts].reverse().find((start) => start < reading);
      if (target !== undefined) columnGoTo(target);
      return;
    }
    const target =
      by === 1 ? chapterStarts.find((start) => viewIndexOf(start) > heading) : [...chapterStarts].reverse().find((start) => viewIndexOf(start) < heading);
    if (target !== undefined) void go(viewIndexOf(target), 'chapter');
  };

  // ---- Controls ----------------------------------------------------------------

  prevButton.addEventListener('click', () => usable(prevButton) && step(-1));
  nextButton.addEventListener('click', () => usable(nextButton) && step(1));
  zoomButtons.in.addEventListener('click', () => usable(zoomButtons.in) && zoom.zoomIn());
  zoomButtons.out.addEventListener('click', () => usable(zoomButtons.out) && zoom.zoomOut());
  zoomButtons.fit.addEventListener('click', () => usable(zoomButtons.fit) && zoom.fit());

  // The slider: the way along, with where it would open in a bubble while it is dragged; it opens there at once
  // (in a column, the column scrolls to that page).
  const valueToIndex = () => Number(range.value) - (twoPages ? 0 : 1);
  const placeBubble = () => {
    const i = valueToIndex();
    const view = views[i] ?? views[0]!;
    const page = typeof view[0] === 'number' ? view[0] : null;
    const first = page ? pageOf(page) : null;
    const chapter = first?.dataset.short?.split(' · ')[1];
    bubble.textContent = page === null ? (root.dataset.endTitle ?? '') : chapter ? `${n(page)} · ${chapter}` : `${n(page)} · ${first?.dataset.label ?? ''}`;
    const min = Number(range.min);
    const max = Number(range.max);
    const thumb = 14;
    const x = ((Number(range.value) - min) / Math.max(1, max - min)) * (range.offsetWidth - thumb) + thumb / 2;
    const room = range.offsetWidth - bubble.offsetWidth / 2;
    bubble.style.transform = `translateX(${Math.max(bubble.offsetWidth / 2, Math.min(room, x)) - bubble.offsetWidth / 2}px)`;
  };
  const goToValue = () => {
    const i = Math.max(0, Math.min(views.length - 1, valueToIndex()));
    if (column) columnGoTo(Math.min(pageCount, firstPage(views[i]!)), 'instant');
    else void go(i, 'instant');
  };
  range.addEventListener('pointerdown', () => {
    scrub.toggleAttribute('data-dragging', true);
    placeBubble();
  });
  range.addEventListener('input', () => {
    if (scrub.hasAttribute('data-dragging')) placeBubble();
    else goToValue();
  });
  range.addEventListener('change', () => {
    scrub.removeAttribute('data-dragging');
    goToValue();
  });
  for (const type of ['pointerup', 'pointercancel', 'blur'] as const) range.addEventListener(type, () => scrub.removeAttribute('data-dragging'));

  // The contents, in the menu, in the page, and the closing card: a few leaves to the chapter, then the book has the
  // focus. In a column, the column scrolls there.
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-book-jump]') : null;
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const page = Number(link.dataset.bookJump);
    if (menu.matches(':popover-open')) menu.hidePopover();
    if (column) {
      columnGoTo(page);
      return;
    }
    const fromOutside = !root.contains(link) || link.closest('.book__end') === null;
    void go(viewIndexOf(page), 'chapter');
    if (fromOutside && !root.hasAttribute('data-full')) root.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
    stage.focus({ preventScroll: true });
  });

  // "Start reading", and the cover beside the introduction: to the book, with the focus on it; in the scroll view, to
  // its first page, since the reader chose to scroll.
  for (const start of document.querySelectorAll('[data-book-start-reading]')) {
    start.addEventListener('click', (event) => {
      event.preventDefault();
      if (column && columnKind === 'pages') {
        columnGoTo(1);
        return;
      }
      if (column) setColumn(null);
      root.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
      stage.focus({ preventScroll: true });
    });
  }

  // ---- Keys ----------------------------------------------------------------

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && root.hasAttribute('data-full')) return keepFocus(event);
    if (event.defaultPrevented) return;
    const target = event.target as Element;
    if (target === range || target.closest('[popover]')) return;
    // [ and ] before the modifiers: many keyboards type them with AltGr, which reads as Ctrl and Alt held together
    if ((event.key === ']' || event.key === '[') && !event.metaKey) {
      event.preventDefault();
      chapterStep(event.key === ']' ? 1 : -1);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const control = target.closest('a, button, input');
    const key = event.key;
    let handled = true;
    if (key === 'Escape') {
      if (zoom.level > 1) zoom.fit();
      else if (root.hasAttribute('data-full')) setFull(false);
      else handled = false;
    } else if (key === 'ArrowRight') step(1, event.repeat);
    else if (key === 'ArrowLeft') step(-1, event.repeat);
    else if (column) handled = false;
    else if (key === 'PageDown' || (key === ' ' && !event.shiftKey && !control)) step(1, event.repeat);
    else if (key === 'PageUp' || (key === ' ' && event.shiftKey && !control)) step(-1, event.repeat);
    else if (key === 'Home') void go(0);
    else if (key === 'End') void go(views.length - 1);
    else if (key === '+' || key === '=') zoom.zoomIn();
    else if (key === '-' || key === '_') zoom.zoomOut();
    else if (key === '0') zoom.fit();
    else handled = false;
    if (handled) event.preventDefault();
  });

  // With nothing else focused and the book at least half in view, the arrow keys turn its pages too (and give the
  // book the focus, for the keys after). Page Up and Down and the space bar keep scrolling the page.
  let stageInView = 0;
  new IntersectionObserver(
    ([entry]) => {
      stageInView = entry?.intersectionRatio ?? 0;
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  ).observe(stage);
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return;
    if (column || stageInView < 0.5 || somethingOpen()) return;
    event.preventDefault();
    stage.focus({ preventScroll: true });
    step(event.key === 'ArrowRight' ? 1 : -1, event.repeat);
  });

  // A sideways swipe on a trackpad turns one page for each swipe, and is not taken by the browser as Back.
  let wheelLast = -Infinity;
  let wheelSum = 0;
  let wheelTurned = false;
  stage.addEventListener(
    'wheel',
    (event) => {
      if (column || zoom.level > 1 || event.ctrlKey) return;
      const now = performance.now();
      // a pause ends a swipe, with the glide a trackpad adds after it
      if (now - wheelLast > 250) {
        wheelSum = 0;
        wheelTurned = false;
      }
      wheelLast = now;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (wheelTurned) return;
      wheelSum += event.deltaX * (event.deltaMode === 1 ? 16 : 1);
      if (Math.abs(wheelSum) < 30) return;
      wheelTurned = true;
      step(wheelSum > 0 ? 1 : -1);
    },
    { passive: false },
  );

  // ---- Pointer: click, tap, drag, swipe, and the corner that lifts ---------------

  type Manual = { turn: Turn; to: number; direction: Direction; ready: boolean; progress: number };
  let press: { x: number; y: number; id: number; type: string; time: number } | null = null;
  let manual: Manual | null = null;
  let peek: Manual | null = null;
  let samples: { x: number; t: number }[] = [];
  let lastTap = { time: 0, x: 0, y: 0 };
  let singleTap: number | undefined;

  const zoomedByBrowser = () => (window.visualViewport?.scale ?? 1) > 1.05;
  const pageBox = () => spread.getBoundingClientRect();
  const pageWidth = () => (twoPages ? pageBox().width / 2 : pageBox().width);

  /** Starts a turn moved by hand: a drag, a swipe, or the corner lifting. */
  const manualTurn = (direction: Direction): Manual | null => {
    const to = index + (direction === 'forward' ? 1 : -1);
    if (to < 0 || to >= views.length || !leafMotion() || turner.busy || !turner.canTurn(1)) return null;
    cancelQueue();
    const state: Manual = { turn: null as unknown as Turn, to, direction, ready: false, progress: 0 };
    void turner
      .prepare(specFor(index, to, 1), { wait: false })
      .then((turn) => {
        state.turn = turn;
        if (manual !== state && peek !== state) return turn.stop();
        turn.start();
        turn.scrub(state.progress);
        state.ready = true;
      })
      .catch(() => {
        if (manual === state) manual = null;
        if (peek === state) peek = null;
      });
    return state;
  };

  const moveManual = (state: Manual, progress: number) => {
    state.progress = progress;
    if (state.ready) state.turn.scrub(progress);
  };

  /** Lets go of a turn moved by hand: on to the next view, or back where it was. */
  const release = (state: Manual, onward: boolean) => {
    const finish = () => {
      if (onward && index === state.to - (state.direction === 'forward' ? 1 : -1)) {
        firstTurn();
        show(state.to);
        state.turn.play();
        play('page');
        lastStart = performance.now();
      } else state.turn.fallBack();
    };
    if (state.ready) finish();
    else if (onward) {
      // the leaf was not ready yet: the page simply changes
      firstTurn();
      void go(state.to, 'instant');
    }
  };

  const cancelPeek = () => {
    if (!peek) return;
    const state = peek;
    peek = null;
    if (state.ready) state.turn.fallBack();
  };

  stage.addEventListener('pointerdown', (event) => {
    if (column || event.button !== 0) return;
    // zoomed in, a mouse moves the pages about (book-zoom.ts) and a finger scrolls them; a tap still counts
    if (zoom.level > 1 && event.pointerType === 'mouse') return;
    if ((event.target as Element).closest('a, button, input')) return;
    press = { x: event.clientX, y: event.clientY, id: event.pointerId, type: event.pointerType, time: performance.now() };
    samples = [{ x: event.clientX, t: event.timeStamp }];
    if (peek) {
      // a press on a lifted corner takes the corner in hand
      manual = peek;
      peek = null;
      stage.setPointerCapture(event.pointerId);
    }
  });

  stage.addEventListener('pointermove', (event) => {
    if (!press) {
      // the outer bottom corner lifts to meet a mouse that comes near
      if (event.pointerType !== 'mouse' || !fine.matches || event.buttons !== 0 || column) return;
      cornerLift(event);
      return;
    }
    if (event.pointerId !== press.id) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    samples.push({ x: event.clientX, t: event.timeStamp });
    if (samples.length > 12) samples.shift();
    if (!manual) {
      if (zoom.level > 1 || Math.abs(dx) <= DRAG_START || Math.abs(dx) <= 1.2 * Math.abs(dy) || zoomedByBrowser()) return;
      manual = manualTurn(dx < 0 ? 'forward' : 'back');
      if (!manual) return;
      stage.setPointerCapture(event.pointerId);
    }
    // the page's edge stays under the finger: it has come as far as the finger has
    const along = manual.direction === 'forward' ? -dx : dx;
    moveManual(manual, progressForReach(along, pageWidth(), twoPages));
  });

  const endPress = (event: PointerEvent, cancelled: boolean) => {
    const started = press;
    press = null;
    if (!started || event.pointerId !== started.id) return;
    if (manual) {
      const state = manual;
      manual = null;
      // how fast it was moving as it was let go: over the last tenth of a second (a hand held still has stopped)
      const end = { x: event.clientX, t: event.timeStamp };
      const recent = samples.filter((sample) => sample.t >= end.t - 100);
      const from = recent[0];
      const velocity = from && from.t < end.t ? ((end.x - from.x) / Math.max(16, end.t - from.t)) * (state.direction === 'forward' ? -1 : 1) : 0;
      // past a third of the way, or flicked, it goes on; otherwise it falls back
      const moved = Math.abs(event.clientX - started.x) > DRAG_START;
      release(state, !cancelled && (!moved || state.progress > 1 / 3 || velocity > 0.3));
      return;
    }
    if (cancelled || zoom.panned) return;
    const moved = Math.hypot(event.clientX - started.x, event.clientY - started.y);
    if (moved > DRAG_START || performance.now() - started.time > 500) return;
    tap(event, started.type);
  };
  stage.addEventListener('pointerup', (event) => endPress(event, false));
  stage.addEventListener('pointercancel', (event) => endPress(event, true));
  stage.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !press) cancelPeek();
  });

  /** A click or a tap on the book. */
  const tap = (event: PointerEvent, type: string) => {
    if (zoomedByBrowser()) return;
    const zoomed = zoom.level > 1;
    // zoomed in, the edges are the window's onto the pages, and turn once the pages are scrolled to that edge
    const box = zoomed ? stage.getBoundingClientRect() : pageBox();
    const width = zoomed ? box.width : pageWidth();
    const x = event.clientX;
    if (type === 'mouse') {
      if (x < box.left || x > box.right) return;
      step(x >= (twoPages ? box.left + width : box.left + width / 2) ? 1 : -1);
      return;
    }
    // On a touch screen, the outer edges turn; the middle zooms (twice) or, in full view, shows and hides the bars (once).
    const edge = (zoomed ? 0.18 : 0.3) * width;
    if (x >= box.right - edge && x <= box.right + 16 && (!zoomed || zoom.atEdge('right'))) return step(1);
    if (x <= box.left + edge && x >= box.left - 16 && (!zoomed || zoom.atEdge('left'))) return step(-1);
    const now = performance.now();
    const twice = now - lastTap.time < 300 && Math.hypot(x - lastTap.x, event.clientY - lastTap.y) < 30;
    lastTap = { time: now, x, y: event.clientY };
    window.clearTimeout(singleTap);
    if (twice) {
      lastTap.time = 0;
      if (zoomed) zoom.fit();
      else zoom.set(2, { x, y: event.clientY });
      return;
    }
    if (root.hasAttribute('data-full')) singleTap = window.setTimeout(() => root.toggleAttribute('data-bars-hidden'), 300);
  };

  // Zoomed in, a finger scrolls the pages; a sideways swipe that finds them already scrolled as far as they go turns the page.
  let swipe: { x: number; y: number; left: number; time: number } | null = null;
  stage.addEventListener(
    'touchstart',
    (event) => {
      const finger = event.touches[0];
      swipe = zoom.level > 1 && event.touches.length === 1 && finger ? { x: finger.clientX, y: finger.clientY, left: stage.scrollLeft, time: performance.now() } : null;
    },
    { passive: true },
  );
  stage.addEventListener(
    'touchend',
    (event) => {
      const started = swipe;
      swipe = null;
      const finger = event.changedTouches[0];
      if (!started || !finger || zoom.level === 1 || event.touches.length > 0) return;
      const dx = finger.clientX - started.x;
      const dy = finger.clientY - started.y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(dy) || performance.now() - started.time > 800) return;
      if (Math.abs(stage.scrollLeft - started.left) > 2) return;
      if (dx < 0 && zoom.atEdge('right')) step(1);
      else if (dx > 0 && zoom.atEdge('left')) step(-1);
    },
    { passive: true },
  );

  /** The corner nearest the mouse, lifted a little: the next page's to turn on, or the last's to turn back. */
  const cornerLift = (event: PointerEvent) => {
    if (reduceMotion.matches || zoom.level > 1 || (turner.busy && !peek)) return cancelPeek();
    const box = pageBox();
    const reach = 96;
    const nearRight = Math.hypot(box.right - event.clientX, box.bottom - event.clientY);
    const nearLeft = twoPages ? Math.hypot(event.clientX - box.left, box.bottom - event.clientY) : Infinity;
    const direction: Direction | null = nearRight < reach ? 'forward' : nearLeft < reach ? 'back' : null;
    if (!direction) return cancelPeek();
    if (peek && peek.direction !== direction) cancelPeek();
    if (!peek) {
      peek = manualTurn(direction);
      if (!peek) return;
    }
    const closeness = 1 - Math.min(nearRight, nearLeft) / reach;
    moveManual(peek, progressForAngle(PEEK_DEGREES * closeness, twoPages));
  };

  // ---- The touch screen's hint -------------------------------------------------

  let hintTimer: number | undefined;
  /** The hint goes after a while, at the first turn, or when the pages are zoomed. */
  function hideHint() {
    window.clearTimeout(hintTimer);
    if (hint.hidden || hint.hasAttribute('data-going')) return;
    hint.toggleAttribute('data-going', true);
    window.setTimeout(() => (hint.hidden = true), reduceMotion.matches ? 0 : 400);
  }
  if (touch.matches) {
    // shown once the book is in view, so it is there to be read
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        seen.disconnect();
        if (anyTurn || zoom.level > 1) return;
        hint.hidden = false;
        hintTimer = window.setTimeout(hideHint, HINT_MS);
      },
      { threshold: 0.5 },
    );
    seen.observe(stage);
  }

  // ---- A column: the scroll view and the text view ----------------------------------

  // Where each page starts in a column: in the scroll view its picture, in the text view its heading (the picture is
  // not shown there, and the heading is).
  const headings = pages.map((page) => page.querySelector<HTMLElement>('.book__page-title')!);
  const tops = () => (columnKind === 'text' ? headings : pages);

  /**
   * While the column glides to a page it was sent to, the pages it passes are
   * not the one being read: the bars keep the page it is going to until it
   * has stopped (or a second has passed, where the end of a scroll is not
   * told).
   */
  let gliding = 0;
  const landed = () => {
    if (!gliding) return;
    window.clearTimeout(gliding);
    gliding = 0;
    followReading();
  };
  addEventListener('scrollend', landed);

  /** The page whose top is the last above the middle of the window: the one being read. */
  let readingFrame = 0;
  const followReading = () => {
    if (readingFrame || gliding) return;
    readingFrame = requestAnimationFrame(() => {
      readingFrame = 0;
      if (!column || gliding) return;
      const marks = tops();
      const line = window.innerHeight * 0.45;
      let low = 0;
      let high = marks.length - 1;
      let found = 0;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (marks[mid]!.getBoundingClientRect().top <= line) {
          found = mid;
          low = mid + 1;
        } else high = mid - 1;
      }
      if (found + 1 === reading) return;
      reading = found + 1;
      describe();
      address();
    });
  };

  /** In a column, to the top of a page. */
  const columnGoTo = (page: number, behavior: ScrollBehavior = reduceMotion.matches ? 'instant' : 'smooth') => {
    reading = Math.max(1, Math.min(pageCount, page));
    describe();
    address();
    if (behavior === 'smooth') {
      window.clearTimeout(gliding);
      gliding = window.setTimeout(landed, 1000);
    }
    tops()[reading - 1]!.scrollIntoView({ block: 'start', behavior });
  };

  /**
   * Into a column (its pages, or its words) or back to the book, at the same
   * page: the one open, the one being read in the column, or from one column
   * to the other, the one being read in it.
   */
  const setColumn = (kind: ColumnKind | null) => {
    if (kind === null ? !column : column && kind === columnKind) return;
    if (kind && root.hasAttribute('data-full')) setFull(false);
    const page = column ? reading : Math.min(firstPage(views[index]!), pageCount);
    if (kind && zoom.level > 1) zoom.fit();
    cancelQueue();
    column = kind !== null;
    if (kind) columnKind = kind;
    root.toggleAttribute('data-scroll', kind === 'pages');
    root.toggleAttribute('data-text', kind === 'text');
    scrollButton.setAttribute('aria-pressed', String(kind === 'pages'));
    textButton.setAttribute('aria-pressed', String(kind === 'text'));
    window.clearTimeout(gliding);
    gliding = 0;
    if (kind) {
      reading = page;
      addEventListener('scroll', followReading, { passive: true });
      tops()[page - 1]!.scrollIntoView({ block: 'start', behavior: 'instant' });
    } else {
      removeEventListener('scroll', followReading);
      show(viewIndexOf(reading));
      root.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    zoomControls();
    describe();
    address();
  };

  /** In a column, the arrows go from page to page. */
  const columnStep = (by: 1 | -1) => columnGoTo(reading + by);

  scrollButton.addEventListener('click', () => setColumn(column && columnKind === 'pages' ? null : 'pages'));
  textButton.addEventListener('click', () => setColumn(column && columnKind === 'text' ? null : 'text'));

  // ---- Full view ---------------------------------------------------------------

  /**
   * In full view the focus goes round the book's own controls, as in a
   * dialog, in the order they stand on the screen: the bars and the book top
   * to bottom, and side by side in the page's own direction.
   */
  const focusOrder = () => {
    const parts = [...body.children] as HTMLElement[];
    const boxes = new Map(parts.map((part) => [part, part.getBoundingClientRect()]));
    const sign = getComputedStyle(root).direction === 'rtl' ? -1 : 1;
    return [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]')]
      .filter((element) => element.checkVisibility() && !element.closest('[inert], [popover]'))
      .map((element, i) => ({ element, i, box: boxes.get(parts.find((part) => part.contains(element))!) }))
      .sort((a, b) => {
        if (!a.box || !b.box) return a.i - b.i;
        const row = Math.abs(a.box.top - b.box.top) < 4 ? 0 : a.box.top - b.box.top;
        return row || (a.box.left - b.box.left) * sign || a.i - b.i;
      })
      .map(({ element }) => element);
  };
  const keepFocus = (event: KeyboardEvent) => {
    // the contents, open over the book, keep their own order
    if ((event.target as Element).closest('[popover]')) return;
    const order = focusOrder();
    if (order.length === 0) return;
    event.preventDefault();
    const at = order.indexOf(document.activeElement as HTMLElement);
    const next = at < 0 ? (event.shiftKey ? order.at(-1) : order[0]) : order[(at + (event.shiftKey ? -1 : 1) + order.length) % order.length];
    next?.focus();
  };

  let inerted: Element[] = [];
  const setFull = (on: boolean) => {
    if (on === root.hasAttribute('data-full')) return;
    if (on && column) setColumn(null);
    root.toggleAttribute('data-full', on);
    root.removeAttribute('data-bars-hidden');
    fullButton.setAttribute('aria-pressed', String(on));
    if (on) {
      // everything else on the page is out of reach until the book is closed again
      for (let node: Element | null = root; node && node !== document.body; node = node.parentElement) {
        for (const sibling of node.parentElement?.children ?? []) {
          if (sibling !== node && !sibling.hasAttribute('inert') && sibling.localName !== 'script') {
            sibling.setAttribute('inert', '');
            inerted.push(sibling);
          }
        }
      }
      stage.focus({ preventScroll: true });
    } else {
      for (const element of inerted) element.removeAttribute('inert');
      inerted = [];
      fullButton.focus({ preventScroll: true });
      root.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };
  fullButton.addEventListener('click', () => setFull(!root.hasAttribute('data-full')));

  // ---- The room there is ----------------------------------------------------------

  new ResizeObserver(() => {
    const two = readSpread();
    if (two === twoPages) return;
    const page = firstPage(views[index]!);
    turner.stopAll();
    cancelQueue();
    twoPages = two;
    views = viewsFor(two);
    prefetched = -1;
    show(page > pageCount ? views.length - 1 : viewIndexOf(page), { address: false });
  }).observe(stage);

  // ---- A picture that will not load ---------------------------------------------

  // Offline, or a new edition published under the reader (its pictures have new names): a reload brings them.
  pageList.addEventListener(
    'error',
    (event) => {
      if (event.target instanceof HTMLImageElement) notice.hidden = false;
    },
    true,
  );
  $<HTMLButtonElement>('[data-book-reload]').addEventListener('click', () => location.reload());

  // ---- Where the reader came for ----------------------------------------------------

  const fromHash = () => {
    const page = /^#page-(\d+)$/.exec(location.hash);
    if (page) return Math.min(pageCount, Math.max(1, Number(page[1])));
    const chapter = /^#chapter-(\d+)$/.exec(location.hash);
    if (chapter) {
      const link = chapterLinks.find((item) => item.dataset.bookChapter === chapter[1]);
      if (link) return Number(link.dataset.start);
    }
    return null;
  };
  addEventListener('hashchange', () => {
    const page = fromHash();
    if (page === null) return;
    if (column) columnGoTo(page, 'instant');
    else void go(viewIndexOf(page), 'instant');
  });

  // Apps' own browsers often cannot download files; a line under each download says what to do.
  if (/\b(FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|BytedanceWebview|musical_ly|Snapchat|LinkedInApp|Pinterest)\b/i.test(navigator.userAgent)) {
    for (const line of document.querySelectorAll<HTMLElement>('[data-book-inapp]')) line.removeAttribute('hidden');
  }

  zoomControls();
  const start = fromHash();
  show(start === null ? 0 : viewIndexOf(start), { address: false });
  if (start !== null) requestAnimationFrame(() => root.scrollIntoView({ block: 'start', behavior: 'instant' }));
}

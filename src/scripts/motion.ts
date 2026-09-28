/**
 * Motion for zagrosian.com, without dependencies.
 *
 * - One-off entrances use the Web Animations API, so the browser can run them
 *   on the compositor.
 * - Scroll-linked effects share one requestAnimationFrame loop. Each frame
 *   measures everything first and writes afterwards, and effects only run
 *   while their element is near the viewport.
 * - Only transform, opacity and colour change.
 *
 * Security: no HTML is generated and no style attributes are written. Styles
 * are set through the CSSOM (element.style.transform), which the
 * Content-Security-Policy allows, and no Trusted Types sink is used.
 *
 * Accessibility: when the visitor prefers reduced motion, nothing moves and
 * highlighted headings stay fully lit. Without JavaScript, everything is
 * visible and static.
 */

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const isBelowFold = (element: Element) => element.getBoundingClientRect().top > window.innerHeight;

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -------------------------------------------------------------------------- */
/* Split headings: words rise one after another as the heading enters view.   */
/* -------------------------------------------------------------------------- */

function initSplitHeadings() {
  const headings = [...document.querySelectorAll<HTMLElement>('[data-split]')].filter(isBelowFold);
  if (headings.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const heading = entry.target as HTMLElement;
        observer.unobserve(heading);

        heading.querySelectorAll<HTMLElement>('.split__inner').forEach((word, index) => {
          word.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], {
            duration: 900,
            delay: Math.min(index * 55, 500),
            easing: EASE_OUT,
            // Hold the hidden position during the delay, then hand back to CSS.
            fill: 'backwards',
          });
        });
        heading.dataset.split = 'done';
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );

  for (const heading of headings) {
    heading.dataset.split = 'pending';
    observer.observe(heading);
  }
}

/* -------------------------------------------------------------------------- */
/* Scroll-linked effects                                                      */
/* -------------------------------------------------------------------------- */

interface ScrollEffect {
  /** The element whose visibility switches the effect on and off. */
  target: Element;
  /** Read layout. Called for every active effect before any `render`. */
  measure(viewportHeight: number): void;
  /** Write styles. */
  render(): void;
}

function runScrollEffects(effects: ScrollEffect[]) {
  if (effects.length === 0) return;

  const byTarget = new Map(effects.map((effect) => [effect.target, effect]));
  const active = new Set<ScrollEffect>();
  let queued = false;

  const frame = () => {
    queued = false;
    const viewportHeight = window.innerHeight;
    for (const effect of active) effect.measure(viewportHeight);
    for (const effect of active) effect.render();
  };

  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const effect = byTarget.get(entry.target);
        if (!effect) continue;
        if (entry.isIntersecting) active.add(effect);
        else active.delete(effect);
      }
      request();
    },
    { rootMargin: '25% 0px' },
  );

  for (const effect of effects) observer.observe(effect.target);
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });
}

/** A layer that drifts slightly slower than the page, for a sense of depth. */
function parallax(frame: HTMLElement, layer: HTMLElement, strength: number): ScrollEffect {
  let offset = 0;
  return {
    target: frame,
    measure(viewportHeight) {
      const rect = frame.getBoundingClientRect();
      const fromCentre = rect.top + rect.height / 2 - viewportHeight / 2;
      offset = clamp(-fromCentre * strength, -64, 64);
    },
    render() {
      layer.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    },
  };
}

/** The footer wordmark rises out of its baseline as the footer comes into view. */
function rise(frame: HTMLElement, layer: HTMLElement): ScrollEffect {
  let shift = 0;
  return {
    target: frame,
    measure(viewportHeight) {
      const rect = frame.getBoundingClientRect();
      const progress = clamp((viewportHeight - rect.top) / rect.height);
      const eased = 1 - (1 - progress) ** 3;
      shift = (1 - eased) * 60;
    },
    render() {
      layer.style.transform = `translate3d(0, ${shift.toFixed(2)}%, 0)`;
    },
  };
}

/** Words in a heading light up one by one as the reader scrolls past it. */
function highlight(heading: HTMLElement): ScrollEffect {
  const words = [...heading.querySelectorAll<HTMLElement>('.split__word')];
  let lit = 0;
  let rendered = -1;
  heading.dataset.highlight = 'active';
  return {
    target: heading,
    measure(viewportHeight) {
      const rect = heading.getBoundingClientRect();
      const progress = clamp((viewportHeight * 0.85 - rect.top) / (rect.height + viewportHeight * 0.35));
      lit = Math.round(progress * words.length);
    },
    render() {
      if (lit === rendered) return;
      words.forEach((word, index) => word.toggleAttribute('data-lit', index < lit));
      rendered = lit;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Legal pages: reading progress and the current section in the contents.     */
/* These are functional feedback rather than decoration, so they also run     */
/* when reduced motion is preferred.                                          */
/* -------------------------------------------------------------------------- */

function readingProgress(track: HTMLElement, bar: HTMLElement): ScrollEffect {
  let progress = 0;
  return {
    target: track,
    measure() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      progress = scrollable > 0 ? clamp(window.scrollY / scrollable) : 1;
    },
    render() {
      bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    },
  };
}

function contentsTracker(content: HTMLElement, links: HTMLAnchorElement[]): ScrollEffect {
  const headings = links
    .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
    .filter((heading): heading is HTMLElement => heading !== null);
  let current = -1;
  let rendered = -2;
  return {
    target: content,
    measure(viewportHeight) {
      const line = viewportHeight * 0.3;
      current = -1;
      headings.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= line) current = index;
      });
    },
    render() {
      if (current === rendered) return;
      links.forEach((link, index) => {
        if (index === current) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      rendered = current;
    },
  };
}

/* -------------------------------------------------------------------------- */

export function initMotion() {
  const effects: ScrollEffect[] = [];

  const track = document.querySelector<HTMLElement>('[data-reading-progress]');
  const bar = track?.firstElementChild;
  if (track && bar instanceof HTMLElement) effects.push(readingProgress(track, bar));

  const content = document.querySelector<HTMLElement>('[data-legal-content]');
  const contentsLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc] a')];
  if (content && contentsLinks.length > 0) effects.push(contentsTracker(content, contentsLinks));

  if (!prefersReducedMotion() && 'IntersectionObserver' in window) {
    initSplitHeadings();

    for (const frame of document.querySelectorAll<HTMLElement>('[data-parallax]')) {
      const layer = frame.firstElementChild;
      if (layer instanceof HTMLElement) effects.push(parallax(frame, layer, Number(frame.dataset.parallax) || 0.1));
    }

    for (const frame of document.querySelectorAll<HTMLElement>('[data-rise]')) {
      const layer = frame.firstElementChild;
      if (layer instanceof HTMLElement) effects.push(rise(frame, layer));
    }

    for (const heading of document.querySelectorAll<HTMLElement>('[data-highlight]')) {
      effects.push(highlight(heading));
    }
  }

  if ('IntersectionObserver' in window) runScrollEffects(effects);
}

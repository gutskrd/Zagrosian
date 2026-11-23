/**
 * Animation runtime (no dependencies).
 *
 * - One-off entrances use the Web Animations API, so they can run on the compositor.
 * - Scroll-linked effects share one requestAnimationFrame loop: each frame reads layout for every
 *   effect first, then writes, and effects only run while their element is near the viewport.
 * - Only transform, opacity and color are animated.
 *
 * CSP: no HTML is generated and no style attributes are written. Styles are set through the CSSOM
 * (`element.style`), which the Content-Security-Policy allows, and no Trusted Types sinks are used.
 *
 * Accessibility: with reduced motion nothing moves and highlighted headings stay fully lit. Without
 * JS everything is visible and static.
 */

import { clamp } from '../utils/math';
import { initStory } from './story';
import { enteredFromAbove, isBelowFold, prefersReducedMotion } from './utils';

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Whether the browser supports CSS scroll-driven animations (`animation-timeline`), which run off
 * the main thread. Where supported, effects that have a CSS implementation (the footer wordmark,
 * reading progress) are left to CSS.
 */
const cssScrollTimelines = () => typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()');

// --- Split headings: words rise in sequence as the heading enters view ---

function initSplitHeadings() {
  const headings = [...document.querySelectorAll<HTMLElement>('[data-split]')].filter(isBelowFold);
  if (headings.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const heading = entry.target as HTMLElement;
        observer.unobserve(heading);
        heading.dataset.split = 'done';
        if (enteredFromAbove(entry)) continue;

        heading.querySelectorAll<HTMLElement>('.split__inner').forEach((word, index) => {
          word.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], {
            duration: 900,
            delay: Math.min(index * 55, 500),
            easing: EASE_OUT,
            // Hold the hidden state through the delay, then hand back to CSS.
            fill: 'backwards',
          });
        });
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );

  for (const heading of headings) {
    heading.dataset.split = 'pending';
    observer.observe(heading);
  }
}

// --- Scroll-linked effects ---

interface ScrollEffect {
  /** Element whose visibility toggles the effect. */
  target: Element;
  /** Reads layout. Called for every active effect before any `render`. */
  measure(viewportHeight: number): void;
  /** Writes styles. */
  render(): void;
}

function runScrollEffects(effects: ScrollEffect[]) {
  if (effects.length === 0) return;

  const byTarget = new Map(effects.map((effect) => [effect.target, effect]));
  const active = new Set<ScrollEffect>();
  let queued = false;
  let measured = false;

  const measure = () => {
    // Use the layout viewport height (`clientHeight`), which stays fixed as mobile browser chrome
    // collapses; `innerHeight` follows the chrome and would make effects jump on every scroll
    // reversal.
    const viewportHeight = document.documentElement.clientHeight;
    for (const effect of active) effect.measure(viewportHeight);
  };

  const frame = () => {
    queued = false;
    if (!measured) measure();
    measured = false;
    for (const effect of active) effect.render();
  };

  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  // Read layout directly in the scroll handler: scroll events fire before this frame's rAF
  // callbacks (including the story's) write styles, so layout is still clean and reading it is
  // free. Reading after those writes would force a second layout.
  const onScroll = () => {
    measure();
    measured = true;
    request();
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
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', request, { passive: true });
}

/**
 * Footer wordmark rises from its baseline in 3D as the footer enters view (transform-origin:
 * bottom). JS fallback for browsers without CSS scroll timelines (Footer.astro).
 */
function rise(frame: HTMLElement, layer: HTMLElement): ScrollEffect {
  let rest = 0;
  let depth = 600;
  return {
    target: frame,
    measure(viewportHeight) {
      const rect = frame.getBoundingClientRect();
      const progress = clamp((viewportHeight - rect.top) / rect.height);
      const eased = 1 - (1 - progress) ** 3;
      rest = 1 - eased;
      depth = Math.max(600, rect.width * 0.9);
    },
    render() {
      layer.style.transform = `perspective(${depth.toFixed(0)}px) rotateX(${(rest * 70).toFixed(2)}deg) translate3d(0, ${(rest * 40).toFixed(2)}%, 0)`;
    },
  };
}

/** Lights up a heading's words one by one as it scrolls past. */
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

// --- Legal pages: reading progress and the active table-of-contents entry ---
// Functional feedback rather than decoration, so these also run with reduced motion.

/** JS fallback for browsers without CSS scroll timelines (LegalLayout.astro). */
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

// --- Pointer depth: with a mouse, the hero logo leans toward the pointer ---

function initPointerDepth() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  // The logo eases toward the pointer across the whole window. The lean uses the individual
  // `rotate` and `translate` properties so it composes with the entrance animation on `transform`.
  // (On the homepage this is the traveling logo from story.ts.)
  const depth = document.querySelector<HTMLElement>('[data-lean]');
  const layer = depth?.firstElementChild;
  if (depth && layer instanceof HTMLElement) {
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let running = false;
    let inView = true;

    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    }).observe(depth);

    const step = () => {
      x += (targetX - x) * 0.07;
      y += (targetY - y) * 0.07;
      // Exposed as custom properties that the layer's styles map to `rotate` and `translate`
      // (Hero.astro), so the story can fade the lean out (`--lean`) once the logo faces the viewer.
      layer.style.setProperty('--lean-x', x.toFixed(3));
      layer.style.setProperty('--lean-y', y.toFixed(3));
      layer.style.setProperty('--lean-angle', `${(Math.hypot(x, y) * 7).toFixed(2)}deg`);
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.002) requestAnimationFrame(step);
      else running = false;
    };
    const start = () => {
      if (!running) {
        running = true;
        requestAnimationFrame(step);
      }
    };

    window.addEventListener(
      'pointermove',
      (event) => {
        if (!inView || event.pointerType !== 'mouse') return;
        targetX = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
        targetY = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
        start();
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => {
      targetX = 0;
      targetY = 0;
      start();
    });
  }
}


export function initMotion() {
  const effects: ScrollEffect[] = [];

  const track = document.querySelector<HTMLElement>('[data-reading-progress]');
  const bar = track?.firstElementChild;
  if (track && bar instanceof HTMLElement && (prefersReducedMotion() || !cssScrollTimelines())) {
    effects.push(readingProgress(track, bar));
  }

  const content = document.querySelector<HTMLElement>('[data-legal-content]');
  const contentsLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc] a')];
  if (content && contentsLinks.length > 0) effects.push(contentsTracker(content, contentsLinks));

  if (!prefersReducedMotion() && 'IntersectionObserver' in window) {
    initSplitHeadings();

    if (!cssScrollTimelines()) {
      for (const frame of document.querySelectorAll<HTMLElement>('[data-rise]')) {
        const layer = frame.firstElementChild;
        if (layer instanceof HTMLElement) effects.push(rise(frame, layer));
      }
    }

    for (const heading of document.querySelectorAll<HTMLElement>('[data-highlight]')) {
      effects.push(highlight(heading));
    }

    initPointerDepth();
    initStory();
  }

  if ('IntersectionObserver' in window) runScrollEffects(effects);
}

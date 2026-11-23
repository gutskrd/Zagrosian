import { enteredFromAbove, prefersReducedMotion } from './utils';

/**
 * Sections below the fold animate in once as they enter the viewport. Content already on screen is
 * left alone (no flicker), and content met while scrolling up appears without animation.
 */
export function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  if (prefersReducedMotion()) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        if (!enteredFromAbove(entry)) {
          element.dataset.reveal = 'done';
          continue;
        }
        // Entered from above: show immediately, without transitions.
        element.dataset.reveal = 'instant';
        requestAnimationFrame(() => requestAnimationFrame(() => (element.dataset.reveal = 'done')));
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );

  for (const element of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    if (element.getBoundingClientRect().top < window.innerHeight) continue;
    element.dataset.reveal = 'pending';
    observer.observe(element);
  }
}

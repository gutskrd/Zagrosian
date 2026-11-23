/** Helpers shared by the scroll-triggered animations. */

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isBelowFold = (element: Element) => element.getBoundingClientRect().top > window.innerHeight;

/**
 * Whether an element entered the viewport from above, i.e. while scrolling up (after a reload or a
 * deep link). Entrances only play for content entering from below; content met while scrolling up
 * is shown as is.
 */
export const enteredFromAbove = (entry: IntersectionObserverEntry) => entry.boundingClientRect.top < 0;

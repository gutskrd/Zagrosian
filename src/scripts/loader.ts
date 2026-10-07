/**
 * The loading screen (Loader.astro). theme-init.js has decided before the
 * first paint whether it shows (`data-loading`); here the animation is
 * fetched once the page itself has loaded and been drawn (until it comes, its
 * first frame shows), and it plays once through, from the Z, through the sun, until the
 * hands are back on the Z (and on, for as long as the page is still loading),
 * then fades away. Should the
 * animation come late (a slow connection), it does not hold up a page that
 * is ready: it lifts four seconds after the page started, at the latest. A
 * click, a tap, a key or a scroll lets the visitor straight in.
 */

/** From the animation's first frame until the hands are back on the Z (ms). */
const ONCE = 3000;
/** The fade, as in Loader.astro. */
const FADE = 500;
/** At the latest, once the page has loaded: this long after it started (ms). */
const LATEST = 4000;

export function initLoader() {
  const root = document.documentElement;
  if (!root.dataset.loading) return;
  const image = document.querySelector<HTMLImageElement>('[data-loader-animation]');
  if (!image) {
    delete root.dataset.loading;
    return;
  }

  const skip = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  let lifted = false;
  const lift = () => {
    if (lifted) return;
    lifted = true;
    for (const type of skip) window.removeEventListener(type, lift, true);
    root.dataset.loading = 'done';
    // Gone once faded, so the animation stops.
    window.setTimeout(() => delete root.dataset.loading, FADE + 50);
  };
  for (const type of skip) window.addEventListener(type, lift, { capture: true, passive: true });

  const loaded = new Promise<void>((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', () => resolve(), { once: true });
  });
  // The animation starts when its image has loaded (until then its first frame
  // shows); should it fail, it is as if it had played.
  const played = new Promise<void>((resolve) => {
    image.addEventListener('load', () => window.setTimeout(resolve, ONCE), { once: true });
    image.addEventListener('error', () => resolve(), { once: true });
  });
  // Once the page has loaded and been drawn, so it never holds up the page's
  // own text, styles, fonts and images, nor its first frame.
  const drawn = new Promise<void>((resolve) => {
    if (performance.getEntriesByName('first-contentful-paint').length) return resolve();
    try {
      new PerformanceObserver((list, observer) => {
        if (!list.getEntriesByName('first-contentful-paint').length) return;
        observer.disconnect();
        resolve();
      }).observe({ type: 'paint', buffered: true });
    } catch {
      resolve();
    }
    // Should the browser not say when it has drawn.
    window.setTimeout(resolve, 1500);
  });
  void Promise.all([loaded, drawn]).then(() => {
    if (!lifted && image.dataset.src) image.src = image.dataset.src;
  });
  const enough = new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, LATEST - performance.now())));
  void Promise.all([loaded, Promise.race([played, enough])]).then(lift);
}

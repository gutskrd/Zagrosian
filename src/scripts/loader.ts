/**
 * The loading screen (Loader.astro). theme-init.js has decided before the
 * first paint whether it shows (`data-loading`); here it plays once through,
 * from the Z, through the sun, until the hands are back on the Z (and on, for
 * as long as the page is still loading), then fades away. A click, a tap, a
 * key or a scroll lets the visitor straight in.
 */

/** From the animation's first frame until the hands are back on the Z (ms). */
const ONCE = 3000;
/** The fade, as in Loader.astro. */
const FADE = 500;

export function initLoader() {
  const root = document.documentElement;
  if (!root.dataset.loading) return;
  const image = document.querySelector<HTMLImageElement>('[data-loader] img');
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
  // The animation starts when its image has loaded; without it, nothing is shown.
  const played = new Promise<void>((resolve) => {
    const start = () => window.setTimeout(resolve, ONCE);
    if (image.complete && image.naturalWidth) start();
    else {
      image.addEventListener('load', start, { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    }
  });
  void Promise.all([loaded, played]).then(lift);
}

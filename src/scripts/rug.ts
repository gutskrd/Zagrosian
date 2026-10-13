/**
 * Loads the 3D rug (rug-scene.ts, with its shaders) only when the rug
 * (Rug.astro) comes within a screen of view, so pages that never reach it,
 * and the first paint of every page, carry none of it.
 */
export function initRug() {
  const stage = document.querySelector<HTMLElement>('[data-rug]');
  if (!stage || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      import('./rug-scene')
        .then(({ mountRug }) => mountRug(stage))
        // Without it, the flat rug stays.
        .catch(() => undefined);
    },
    { rootMargin: '100% 0px' },
  );
  observer.observe(stage);
}

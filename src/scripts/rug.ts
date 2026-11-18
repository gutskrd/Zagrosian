/**
 * Loads the 3D rug (rug-scene.ts, with its shaders) and the paper plane
 * under it (plane.ts) only when the rug (Rug.astro) comes within a screen of
 * view, so pages that never reach it, and the first paint of every page,
 * carry none of it; and sets them up when the page is still, not during a
 * swipe.
 *
 * Also wires the "Lift the rug" button (Underneath.astro): with the 3D rug it
 * asks the scene to fold the corner over; without it (no WebGL, or before it
 * is ready) the flat picture is drawn back instead. Either way the label
 * follows, so it always says what pressing it will do.
 */
export function initRug() {
  const stage = document.querySelector<HTMLElement>('[data-rug]');
  if (!stage) return;

  // The flat picture is shown whole, once decoded, never as the rows that
  // have arrived so far (Rug.astro keeps it out of sight until then). Once it
  // has come up fully, the rug covers the floor (`data-covered`): only then is
  // the paper plane drawn under it (plane.ts), never on the bare floor.
  const picture = stage.querySelector<HTMLImageElement>('.rug__flat img');
  const covered = () => stage.setAttribute('data-covered', '');
  const pictured = () => {
    stage.setAttribute('data-pictured', '');
    if (!picture) return covered();
    picture.addEventListener('transitionend', covered, { once: true });
    // In case no transition runs (it was already shown, or styles differ).
    window.setTimeout(covered, 600);
  };
  if (picture) picture.decode().then(pictured, pictured);
  else pictured();

  const button = document.querySelector<HTMLButtonElement>('[data-rug-button]');
  if (button) {
    button.setAttribute('data-ready', '');
    const label = (lifted: boolean) => {
      button.textContent = (lifted ? button.dataset.lay : button.dataset.lift) ?? '';
    };
    button.addEventListener('click', () => {
      // Someone has looked under the rug (the paper plane, plane.ts, then flies).
      stage.setAttribute('data-looked', '');
      if (stage.hasAttribute('data-live')) {
        stage.dispatchEvent(new CustomEvent('rug:toggle'));
      } else {
        const lifted = !stage.hasAttribute('data-lifted');
        stage.toggleAttribute('data-lifted', lifted);
        label(lifted);
      }
    });
    stage.addEventListener('rug:lifted', (event) => label((event as CustomEvent<boolean>).detail));
  }

  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      // Fetched at once, but set up once the page is still: compiling the
      // rug's shaders and taking its picture onto the graphics card are a
      // heavy frame or two, which on a slower phone would catch a swipe. The
      // flat picture, the same rug, is there until then.
      const scene = import('./rug-scene');
      const plane = import('./plane');
      void whenStill().then(() => {
        scene
          .then(({ mountRug }) => mountRug(stage))
          // Without it, the flat rug stays.
          .catch(() => undefined);
        plane
          .then(({ initPlane }) => initPlane())
          // Without it, the proverb's sheet simply lies where it is.
          .catch(() => undefined);
      });
    },
    { rootMargin: '100% 0px' },
  );
  observer.observe(stage);
}

/** Resolves once the page has not scrolled for a moment (at once, if it is not scrolling). */
function whenStill(quiet = 150) {
  return new Promise<void>((resolve) => {
    let timer = 0;
    const wait = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        removeEventListener('scroll', wait);
        resolve();
      }, quiet);
    };
    addEventListener('scroll', wait, { passive: true });
    wait();
  });
}

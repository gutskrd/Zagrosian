/**
 * Lazy-loads the WebGL rug (rug-scene.ts) and the paper plane (plane.ts) once the rug is within one
 * viewport of the screen, so pages that never reach it pay nothing for them. Setup is deferred
 * until scrolling stops.
 *
 * Also wires the "Lift the rug" button: it toggles the 3D rug when it is live and the flat fallback
 * image otherwise, keeping the label in sync.
 */
export function initRug() {
  const stage = document.querySelector<HTMLElement>('[data-rug]');
  if (!stage) return;

  // Reveal the flat image only once it is fully decoded, never progressively. `data-covered` marks
  // it as fully visible; plane.ts waits for it before drawing the plane under the rug.
  const picture = stage.querySelector<HTMLImageElement>('.rug__flat img');
  const covered = () => stage.setAttribute('data-covered', '');
  const pictured = () => {
    stage.setAttribute('data-pictured', '');
    if (!picture) return covered();
    picture.addEventListener('transitionend', covered, { once: true });
    // Fallback for when no transition runs (already visible, or no transition styles).
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
      // Marks the rug as opened; plane.ts launches the plane on this.
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
      // Fetch now, initialize once scrolling stops: shader compilation and the texture upload cost
      // a frame or two, which would stall a swipe on low-end devices. The flat image stands in
      // until then.
      const scene = import('./rug-scene');
      const plane = import('./plane');
      void whenStill().then(() => {
        scene
          .then(({ mountRug }) => mountRug(stage))
          // Module failed to load: keep the flat image.
          .catch(() => undefined);
        plane
          .then(({ initPlane }) => initPlane())
          // Module failed to load: the proverb sheet stays static.
          .catch(() => undefined);
      });
    },
    { rootMargin: '100% 0px' },
  );
  observer.observe(stage);
}

/** Resolves once no scroll event has fired for `quiet` ms. */
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

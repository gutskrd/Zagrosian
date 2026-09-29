/**
 * Smooth, weighted scrolling for mouse wheels and trackpads (Lenis), and large
 * type that leans with the speed of the scroll.
 *
 * The page still scrolls natively: Lenis eases the wheel's steps, so sticky
 * elements, anchors, the keyboard and assistive technology work as usual.
 * Touch screens keep their own scrolling. Links to a section of the page
 * glide there, stopping below the header. Menus, dialogs and anything marked
 * `data-lenis-prevent` scroll on their own.
 *
 * Not used when the visitor prefers reduced motion.
 */
import Lenis from 'lenis';

let lenis: Lenis | undefined;

const headerHeight = () => document.querySelector<HTMLElement>('[data-site-header]')?.offsetHeight ?? 0;

export function initSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  lenis = new Lenis({
    autoRaf: true,
    lerp: 0.085,
    anchors: { offset: -headerHeight() },
    prevent: (node) => node instanceof Element && node.closest('dialog, [popover], [data-lenis-prevent]') !== null,
  });

  // Large type (`data-velocity`) leans with the speed of the scroll, and
  // straightens as it settles.
  const leaning = [...document.querySelectorAll<HTMLElement>('[data-velocity]')];
  if (leaning.length > 0) {
    let written = 0;
    lenis.on('scroll', ({ velocity }: Lenis) => {
      const angle = Math.max(-4, Math.min(4, velocity * -0.09));
      if (Math.abs(angle - written) < 0.01) return;
      written = Math.abs(angle) < 0.02 ? 0 : angle;
      for (const element of leaning) element.style.transform = written ? `skewY(${written.toFixed(2)}deg)` : '';
    });
  }

  // Hold the page still while the opening screen, a modal dialog or the menu
  // is up. The menu lets go as it starts to close (`beforetoggle`), so a link
  // in it to a section of this page can glide there as it lifts.
  const menu = document.querySelector('[data-site-menu]');
  let menuOpen = false;
  const sync = () => {
    const held =
      document.documentElement.dataset.intro === 'running' || document.querySelector('dialog[open]') !== null || menuOpen;
    if (held) lenis?.stop();
    else lenis?.start();
  };
  menu?.addEventListener('beforetoggle', (event) => {
    menuOpen = (event as ToggleEvent).newState === 'open';
    sync();
  });
  sync();
  document.addEventListener('intro:end', sync);
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-intro'],
  });
  for (const dialog of document.querySelectorAll('dialog')) {
    new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }
}

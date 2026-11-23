/**
 * Site navigation: the sticky header, the full-screen menu, the current-section highlight and deep
 * links to homepage sections.
 */
import { isOpen } from './utils/popover';

/** Adds a hairline under the sticky header once the page has scrolled. */
export function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return;

  let queued = false;

  const update = () => {
    queued = false;
    header.toggleAttribute('data-scrolled', window.scrollY > 4);
  };

  update();
  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
}

/**
 * Keeps deep-linked sections (/#about, /de#faq) in place while the page settles. The browser jumps
 * to the target before fonts, images and the story stage have loaded; as content above grows, the
 * section would slide under the header. It is re-aligned on every layout change until the user
 * scrolls or a few seconds after load.
 */
export function initDeepLink() {
  // A hash with invalid percent-encoding (`#%`) names no section and must not break the rest of
  // this script.
  let id = '';
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }
  const target = id ? document.getElementById(id) : null;
  // Book deep links (#page-12, #chapter-3) are handled by the reader (book/index.ts).
  if (!target || target.closest('[data-book]')) return;

  const inputs = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  let queued = false;

  const align = () => {
    queued = false;
    // Offset by the header, matching `scroll-padding-top` (global.css).
    const header = document.querySelector<HTMLElement>('[data-site-header]')?.offsetHeight ?? 0;
    if (Math.abs(target.getBoundingClientRect().top - header) >= 2) {
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(align);
  };

  // Re-align on layout changes, and when a page transition interrupts the browser's own jump
  // (smooth scrolling can stop short, even at the top).
  const observer = new ResizeObserver(schedule);
  observer.observe(document.body);
  window.addEventListener('scroll', schedule, { passive: true });

  const release = () => {
    observer.disconnect();
    window.removeEventListener('scroll', schedule);
    inputs.forEach((type) => window.removeEventListener(type, release));
  };
  inputs.forEach((type) => window.addEventListener(type, release, { passive: true }));

  // The homepage entrance waits up to 2.5 s for fonts and images (theme-init.js); hold a little
  // longer than that.
  const letGo = () => window.setTimeout(release, 3000);
  if (document.readyState === 'complete') letGo();
  else window.addEventListener('load', letGo, { once: true });
}

/**
 * Full-screen menu (SiteMenu.astro). The popover handles open, close, Escape and focus; links just
 * need to close it, so in-page links scroll as the menu closes.
 */
export function initMenu() {
  const menu = document.querySelector<HTMLElement>('[data-site-menu]');
  if (!menu) return;

  menu.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a') && isOpen(menu)) {
      menu.hidePopover();
    }
  });
}

/**
 * Highlights the nav link of the current section: the one crossing a thin band slightly above the
 * viewport's middle.
 */
export function initSectionNav() {
  const links = new Map<string, HTMLAnchorElement>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-nav-section]')) {
    const id = link.dataset.navSection;
    if (id && document.getElementById(id)) links.set(id, link);
  }
  if (links.size === 0 || !('IntersectionObserver' in window)) return;

  const visible = new Set<string>();
  const update = () => {
    const current = [...links.keys()].find((id) => visible.has(id));
    for (const [id, link] of links) {
      if (id === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      update();
    },
    { rootMargin: '-40% 0px -55% 0px' },
  );

  for (const id of links.keys()) observer.observe(document.getElementById(id)!);
}

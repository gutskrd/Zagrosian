/** Adds a hairline under the sticky header once the page has scrolled. */
function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return;

  const update = () => header.toggleAttribute('data-scrolled', window.scrollY > 4);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/** The popover handles open, close, Escape and focus; links just need to close it. */
function initMobileMenu() {
  const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
  if (!menu) return;

  menu.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a') && menu.matches(':popover-open')) {
      menu.hidePopover();
    }
  });
}

/**
 * Sections below the fold rise in once as they enter the viewport.
 * Anything already on screen is left untouched, so nothing flickers.
 */
function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.reveal = 'done';
        observer.unobserve(entry.target);
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

/**
 * Legal pages: the table of contents is collapsed on small screens and
 * always open on wide ones, where it sits in a sticky sidebar.
 */
function initTableOfContents() {
  const toc = document.querySelector<HTMLDetailsElement>('[data-toc]');
  if (!toc) return;

  const wide = window.matchMedia('(min-width: 64rem)');
  const sync = () => {
    toc.open = wide.matches;
  };
  sync();
  wide.addEventListener('change', sync);

  toc.addEventListener('click', (event) => {
    if (!wide.matches && event.target instanceof Element && event.target.closest('a')) {
      toc.open = false;
    }
  });
}

initHeader();
initMobileMenu();
initReveal();
initTableOfContents();

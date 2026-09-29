import { initMotion } from './motion';
import { initTheme } from './theme';

/**
 * Adds a hairline under the sticky header once the page has scrolled, and
 * switches the header to its dark treatment while it sits over a dark section.
 */
function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return;

  const darkSections = [...document.querySelectorAll<HTMLElement>('.inverse')];
  let queued = false;

  const update = () => {
    queued = false;
    const line = header.offsetHeight / 2;
    const onDark = darkSections.some((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= line && rect.bottom >= line;
    });
    header.toggleAttribute('data-scrolled', window.scrollY > 4);
    header.toggleAttribute('data-on-dark', onDark);
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

/**
 * Highlights the navigation link of the section being read. A section counts
 * as current while it crosses a thin band a little above the middle of the screen.
 */
function initSectionNav() {
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

/**
 * Copy buttons next to email addresses. They stay hidden where the Clipboard
 * API is unavailable. The icon turns into a check mark, and a live region
 * announces the result to screen readers.
 */
function initCopyButtons() {
  if (!navigator.clipboard?.writeText) return;

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    const status = button.closest('section')?.querySelector<HTMLElement>('[data-copy-status]');
    const value = button.dataset.copy ?? '';
    let reset: number | undefined;

    button.hidden = false;
    button.addEventListener('click', async () => {
      window.clearTimeout(reset);
      try {
        await navigator.clipboard.writeText(value);
        button.toggleAttribute('data-copied', true);
        if (status) status.textContent = `${value} copied to the clipboard.`;
      } catch {
        if (status) status.textContent = `Could not copy. Select ${value} to copy it instead.`;
      }
      reset = window.setTimeout(() => {
        button.removeAttribute('data-copied');
        if (status) status.textContent = '';
      }, 2000);
    });
  }
}

initHeader();
initMobileMenu();
initReveal();
initTableOfContents();
initSectionNav();
initCopyButtons();
initTheme();
initMotion();

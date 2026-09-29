import { initCommandMenu } from './command';
import { initCursor } from './cursor';
import { initIntro } from './intro';
import { initMagnetic } from './magnetic';
import { initSmoothScroll } from './smooth';
import { initSound } from './sound';
import { initText } from './text';
import { initLanguageMenu, initLanguageSuggestion } from './language';
import { initMotion } from './motion';
import { initTheme } from './theme';

/** Adds a hairline under the sticky header once the page has scrolled. */
function initHeader() {
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
 * The full-screen menu (SiteMenu.astro). The popover handles open, close,
 * Escape and focus; a link just needs to close it, so a link to a section of
 * this page scrolls there as the menu lifts.
 */
function initMenu() {
  const menu = document.querySelector<HTMLElement>('[data-site-menu]');
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
        if (status) status.textContent = button.dataset.copiedMessage ?? '';
      } catch {
        if (status) status.textContent = button.dataset.copyFailedMessage ?? '';
      }
      reset = window.setTimeout(() => {
        button.removeAttribute('data-copied');
        if (status) status.textContent = '';
      }, 2000);
    });
  }
}

/**
 * The current time at the headquarters, next to the country in About. It is
 * formatted for the page's language and updates on the minute.
 */
function initLocalTime() {
  for (const slot of document.querySelectorAll<HTMLElement>('[data-local-time]')) {
    const { timeZone, template = '{time}' } = slot.dataset;
    if (!timeZone) continue;

    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat(document.documentElement.lang, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    } catch {
      continue;
    }

    const time = document.createElement('time');
    const [before = '', after = ''] = template.split('{time}');
    slot.append(before, time, after);
    slot.hidden = false;

    const tick = () => {
      const now = new Date();
      time.dateTime = now.toISOString();
      time.textContent = formatter.format(now);
      window.setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
    };
    tick();
  }
}

/**
 * Legal pages: a print button, and a button beside each section heading that
 * copies a link to that section. Both need JavaScript, so they are added here.
 */
function initLegalTools() {
  const article = document.querySelector<HTMLElement>('[data-legal]');
  if (!article) return;
  const status = article.querySelector<HTMLElement>('[data-legal-status]');

  const print = article.querySelector<HTMLButtonElement>('[data-print]');
  print?.addEventListener('click', () => window.print());

  if (!navigator.clipboard?.writeText) return;
  const label = article.dataset.copyLink ?? '';
  const copied = article.dataset.linkCopied ?? '';
  const svg = 'http://www.w3.org/2000/svg';

  for (const heading of article.querySelectorAll<HTMLHeadingElement>('[data-legal-content] h2[id]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'heading-link';
    button.setAttribute('aria-label', `${label}: ${heading.textContent?.trim() ?? ''}`);

    const icon = document.createElementNS(svg, 'svg');
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg, 'path');
    path.setAttribute('d', 'M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1');
    icon.append(path);
    button.append(icon);

    button.addEventListener('click', async () => {
      const url = new URL(window.location.href);
      url.hash = heading.id;
      try {
        await navigator.clipboard.writeText(url.href);
        history.replaceState(null, '', url.hash);
        button.toggleAttribute('data-copied', true);
        if (status) status.textContent = copied;
        window.setTimeout(() => {
          button.removeAttribute('data-copied');
          if (status) status.textContent = '';
        }, 2000);
      } catch {
        // Copying was refused; the heading's address is still in the contents.
      }
    });

    heading.append(button);
  }
}

// First, so the opening screen's counter starts at once.
initIntro();
initHeader();
initMenu();
initReveal();
initTableOfContents();
initSectionNav();
initCopyButtons();
initLocalTime();
initLegalTools();
initCommandMenu();
initTheme();
initLanguageMenu();
initLanguageSuggestion();
initMotion();
initText();
initSound();
initCursor();
initMagnetic();
initSmoothScroll();

// The hero horseman in ink particles, loaded separately and only when
// theme-init.js has found it welcome and the page has a hero.
if (document.documentElement.dataset.ink) {
  if (document.querySelector('[data-ink-canvas]')) {
    import('./ink')
      .then(({ initInk }) => initInk())
      .catch(() => {
        // Back to the still image, without replaying its entrance once shown.
        const root = document.documentElement;
        if (root.dataset.ink === 'ready') root.dataset.ink = 'off';
        else delete root.dataset.ink;
      });
  } else {
    delete document.documentElement.dataset.ink;
  }
}

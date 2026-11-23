/**
 * Entry point for the script bundle on every page (BaseLayout.astro). Small features live here;
 * larger ones (sound, motion, theme, command menu) have their own modules. Initialization runs at
 * the bottom of the file.
 */
// Must load first: installs the Popover API fallback for older browsers.
import { isOpen } from './popover';
import { initCommandMenu } from './command';
import { initDeer } from './deer';
import { initEyes } from './eyes';
import { initSound } from './sound';
import { initText } from './text';
import { initLanguageMenu, initLanguageSuggestion } from './language';
import { enteredFromAbove, initMotion } from './motion';
import { initRegistration } from './registration';
import { initRug } from './rug';
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
 * Keeps deep-linked sections (/#about, /de#faq) in place while the page settles. The browser jumps
 * to the target before fonts, images and the story stage have loaded; as content above grows, the
 * section would slide under the header. It is re-aligned on every layout change until the user
 * scrolls or a few seconds after load.
 */
function initDeepLink() {
  // A hash with invalid percent-encoding (`#%`) names no section and must not break the rest of
  // this script.
  let id = '';
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }
  const target = id ? document.getElementById(id) : null;
  // Book deep links (#page-12, #chapter-3) are handled by the reader (book.ts).
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
function initMenu() {
  const menu = document.querySelector<HTMLElement>('[data-site-menu]');
  if (!menu) return;

  menu.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a') && isOpen(menu)) {
      menu.hidePopover();
    }
  });
}

/**
 * Sections below the fold animate in once as they enter the viewport. Content already on screen is
 * left alone (no flicker), and content met while scrolling up appears without animation.
 */
function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        if (!enteredFromAbove(entry)) {
          element.dataset.reveal = 'done';
          continue;
        }
        // Entered from above: show immediately, without transitions.
        element.dataset.reveal = 'instant';
        requestAnimationFrame(() => requestAnimationFrame(() => (element.dataset.reveal = 'done')));
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
 * Legal pages: the table of contents is collapsible on small screens and always open in the sticky
 * sidebar on wide ones.
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
 * Highlights the nav link of the current section: the one crossing a thin band slightly above the
 * viewport's middle.
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
 * Copy buttons next to email addresses, hidden where the Clipboard API is unavailable. The icon
 * switches to a check mark and a live region announces the result.
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
 * Share button in the site menu: the native share sheet where supported (Web Share API), otherwise
 * copies the canonical URL and confirms on the button. Hidden where neither is available.
 */
function initShare() {
  const canShare = typeof navigator.share === 'function';
  const canCopy = typeof navigator.clipboard?.writeText === 'function';
  if (!canShare && !canCopy) return;

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-share]')) {
    const text = button.querySelector<HTMLElement>('[data-share-text]');
    const status = button.parentElement?.querySelector<HTMLElement>('[data-share-status]');
    const label = text?.textContent ?? '';
    let reset: number | undefined;
    button.hidden = false;

    const copy = async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        return;
      }
      window.clearTimeout(reset);
      if (text) text.textContent = button.dataset.copiedLabel ?? label;
      if (status) status.textContent = button.dataset.copiedStatus ?? '';
      reset = window.setTimeout(() => {
        if (text) text.textContent = label;
        if (status) status.textContent = '';
      }, 2000);
    };

    button.addEventListener('click', async () => {
      const url = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? location.href;
      const data = { title: document.title, url };
      if (canShare && (navigator.canShare?.(data) ?? true)) {
        try {
          await navigator.share(data);
          return;
        } catch (error) {
          // Dismissed by the user.
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
      if (canCopy) await copy(url);
    });
  }
}

/**
 * Local time at headquarters, next to the country in About; formatted for the page locale and
 * updated every minute.
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
 * Legal pages: a print button, and a copy-link button next to each section heading. Both require
 * JS, so they are added here.
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
        // Clipboard write refused; the link is still available in the table of contents.
      }
    });

    heading.append(button);
  }
}

// --- Init ---
// The same bundle runs on every page; each feature looks for its own elements and is a no-op without them.

// First, so the footer's registration details are requested as early as possible.
initRegistration();
initHeader();
initDeepLink();
initMenu();
initReveal();
initTableOfContents();
initSectionNav();
initCopyButtons();
initShare();
initLocalTime();
initLegalTools();
initCommandMenu();
initTheme();
initLanguageMenu();
initLanguageSuggestion();
initMotion();
initText();
initSound();
initEyes();
initDeer();
initRug();

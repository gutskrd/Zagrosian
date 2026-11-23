/** Legal pages (LegalLayout.astro): the table of contents, the print button and heading links. */

/** The table of contents: collapsible on small screens, always open in the sidebar on wide ones. */
export function initTableOfContents() {
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

/** Adds the print button and a copy-link button beside each section heading (both need JS). */
export function initLegalTools() {
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

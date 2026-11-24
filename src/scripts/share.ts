/** Copy buttons next to email addresses, and the share button in the site menu. */

/**
 * Copy buttons next to email addresses, hidden where the Clipboard API is unavailable. The icon
 * switches to a check mark and a live region announces the result.
 */
export function initCopyButtons() {
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
export function initShare() {
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

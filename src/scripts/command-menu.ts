/**
 * Command menu (CommandMenu.astro).
 *
 * Opens with Ctrl+K / Cmd+K, with "/" when not typing, and from the header's search button. Typing
 * filters the entries; arrow keys move through them, Enter activates and Escape closes. Focus stays
 * in the search field, which points assistive technology at the active entry via
 * aria-activedescendant.
 *
 * Entries are rendered at build time; this script only toggles attributes and sets text, keeping
 * CSP and Trusted Types strict.
 */
import { play, setSound, soundEnabled } from './sound';
import { currentPreference, setThemePreference, type Preference } from './theme';

/** Lowercases and strips diacritics and Arabic harakat: "Français" -> "francais". */
const normalize = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Whether the user is typing in an editable element, so "/" is left alone. */
function isEditing(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select, [contenteditable]'));
}

export function initCommandMenu() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-command-menu]');
  const input = dialog?.querySelector<HTMLInputElement>('[data-command-input]');
  const list = dialog?.querySelector<HTMLElement>('[data-command-list]');
  const empty = dialog?.querySelector<HTMLElement>('[data-command-empty]');
  const status = document.querySelector<HTMLElement>('[data-command-status]');
  if (!dialog || !input || !list || !empty || typeof dialog.showModal !== 'function') return;

  const options = [...dialog.querySelectorAll<HTMLElement>('[data-command-option]')];
  const groups = [...dialog.querySelectorAll<HTMLElement>('[data-command-group]')];
  const searchText = new Map(options.map((option) => [option, option.dataset.search ?? '']));
  let active: HTMLElement | undefined;

  const visibleOptions = () => options.filter((option) => !option.hidden);

  function setActive(option: HTMLElement | undefined, scroll = true) {
    if (active) active.setAttribute('aria-selected', 'false');
    active = option;
    if (option) {
      option.setAttribute('aria-selected', 'true');
      input!.setAttribute('aria-activedescendant', option.id);
      if (scroll) option.scrollIntoView({ block: 'nearest' });
    } else {
      input!.removeAttribute('aria-activedescendant');
    }
  }

  function filter() {
    const words = normalize(input!.value).split(/\s+/).filter(Boolean);
    for (const option of options) {
      const text = searchText.get(option) ?? '';
      option.hidden = !words.every((word) => text.includes(word));
    }
    for (const group of groups) {
      group.hidden = !group.querySelector('[data-command-option]:not([hidden])');
    }
    const visible = visibleOptions();
    empty!.hidden = visible.length > 0;
    list!.scrollTop = 0;
    setActive(visible[0], false);
  }

  /** Marks the current theme and sound settings. */
  function markSettings() {
    const current = { theme: currentPreference(), sound: soundEnabled() ? 'on' : 'off' };
    for (const option of options) {
      const { action, value } = option.dataset;
      if (action !== 'theme' && action !== 'sound') continue;
      if (value === current[action]) option.setAttribute('aria-current', 'true');
      else option.removeAttribute('aria-current');
    }
  }

  function open() {
    if (dialog!.open) return;
    input!.value = '';
    markSettings();
    filter();
    dialog!.showModal();
    input!.focus();
    play('open');
  }

  function close() {
    if (dialog!.open) dialog!.close();
  }

  dialog.addEventListener('close', () => play('close'));

  function announce(message: string) {
    if (!status) return;
    status.textContent = '';
    // Set after a tick so screen readers announce repeated messages.
    window.setTimeout(() => (status.textContent = message), 50);
  }

  function run(option: HTMLElement) {
    const { action, value = '' } = option.dataset;
    close();

    if (action === 'theme') {
      setThemePreference(value as Preference);
      return;
    }
    if (action === 'sound') {
      setSound(value === 'on');
      return;
    }
    if (action === 'share') {
      // Same as Share in the site menu (share.ts): native share sheet, else copy the URL.
      const url = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? location.href;
      const data = { title: document.title, url };
      const copy = () =>
        navigator.clipboard
          ?.writeText(url)
          .then(() => announce(status?.dataset.linkCopied ?? ''))
          .catch(() => {});
      if (typeof navigator.share === 'function' && (navigator.canShare?.(data) ?? true)) {
        navigator.share(data).catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) copy();
        });
      } else {
        copy();
      }
      return;
    }
    if (action === 'copy') {
      navigator.clipboard
        ?.writeText(value)
        .then(() => announce((status?.dataset.copied ?? '{email}').replace('{email}', value)))
        .catch(() => {});
      return;
    }
    // Links are clicked rather than navigated, so modifier clicks, the language preference and
    // same-page anchors behave as anywhere else on the site.
    if (option instanceof HTMLAnchorElement) option.click();
  }

  function move(step: number) {
    const visible = visibleOptions();
    if (visible.length === 0) return;
    const index = active ? visible.indexOf(active) : -1;
    setActive(visible[(index + step + visible.length) % visible.length]);
  }

  input.addEventListener('input', filter);

  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    const visible = visibleOptions();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
      case 'End':
        if (!event.ctrlKey && input.value) return;
        event.preventDefault();
        setActive(event.key === 'Home' ? visible[0] : visible[visible.length - 1]);
        break;
      case 'Enter':
        event.preventDefault();
        if (active) run(active);
        break;
    }
  });

  for (const option of options) {
    option.addEventListener('pointermove', () => {
      if (active !== option) setActive(option, false);
    });
    option.addEventListener('click', (event) => {
      // Let modifier clicks open links in a new tab or window.
      if (option instanceof HTMLAnchorElement && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
      if (option instanceof HTMLAnchorElement) {
        close();
        return;
      }
      event.preventDefault();
      run(option);
    });
  }

  // Clicking the backdrop outside the panel closes the menu.
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) close();
  });

  for (const trigger of document.querySelectorAll('[data-command-open]')) {
    trigger.addEventListener('click', open);
  }

  document.addEventListener('keydown', (event) => {
    const shortcut = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey;
    if (shortcut) {
      event.preventDefault();
      if (dialog.open) close();
      else open();
      return;
    }
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !dialog.open && !isEditing(event.target)) {
      event.preventDefault();
      open();
    }
  });
}

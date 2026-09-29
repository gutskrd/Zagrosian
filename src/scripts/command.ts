/**
 * Quick navigation (src/components/CommandMenu.astro).
 *
 * Opens with Ctrl K or ⌘K, with "/" when the visitor is not typing, and from
 * the search button in the header. Typing filters the entries; the arrow keys
 * move through them, Enter opens one and Escape closes the menu. The search
 * field keeps focus throughout and points screen readers at the highlighted
 * entry with aria-activedescendant.
 *
 * Security: entries are written at build time. This script only toggles
 * attributes and sets text, so the Content-Security-Policy and Trusted Types
 * stay strict.
 */
import { play, setSound, soundEnabled } from './sound';
import { currentPreference, setThemePreference, type Preference } from './theme';

/** Lowercase, without accents or Arabic vowel marks: "Français" → "francais". */
const normalise = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

const isApple = () => /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

/** True while the visitor is typing somewhere, so "/" is left alone. */
function isEditing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select, [contenteditable]'))
  );
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

  // The shortcut shown on the header button, for this platform.
  for (const keys of document.querySelectorAll<HTMLElement>('[data-command-shortcut]')) {
    keys.textContent = isApple() ? '⌘K' : 'Ctrl K';
  }

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
    const words = normalise(input!.value).split(/\s+/).filter(Boolean);
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

  /** Marks the current theme and sound setting. */
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
    // A fresh message, so screen readers read it even when it repeats.
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
    if (action === 'copy') {
      navigator.clipboard
        ?.writeText(value)
        .then(() => announce((status?.dataset.copied ?? '{email}').replace('{email}', value)))
        .catch(() => {});
      return;
    }
    // Links: a click, so middle-clicks, the language memory and same-page
    // section links all behave as they do elsewhere on the site.
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
      // Let links open in a new tab or window as usual.
      if (option instanceof HTMLAnchorElement && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
      if (option instanceof HTMLAnchorElement) {
        close();
        return;
      }
      event.preventDefault();
      run(option);
    });
  }

  // A click on the backdrop, outside the panel, closes the menu.
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
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

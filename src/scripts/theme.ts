/**
 * Light and dark theme. The visitor can follow their system setting (the
 * default) or choose light or dark; the choice is kept in localStorage.
 *
 * - The header button switches between light and dark.
 * - The footer control offers System, Light and Dark.
 * - Where the browser supports view transitions, the new theme spreads out in
 *   a circle from the control that was used.
 *
 * theme-init.js applies the saved theme before the page is drawn; this module
 * keeps it up to date afterwards.
 */

type Preference = 'system' | 'light' | 'dark';
type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
/** Browser toolbar colours, matching --color-paper. */
const THEME_COLORS: Record<Theme, string> = { light: '#ffffff', dark: '#0a0a0a' };

const root = document.documentElement;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function readPreference(): Preference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage unavailable: follow the system.
  }
  return 'system';
}

function savePreference(preference: Preference) {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The choice then lasts for this page only.
  }
}

const resolve = (preference: Preference): Theme =>
  preference === 'system' ? (systemDark.matches ? 'dark' : 'light') : preference;

/** Applies a preference to the page and to both controls. */
function render(preference: Preference) {
  const theme = resolve(preference);
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;

  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLORS[theme];
  }
  for (const toggle of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  }
  for (const input of document.querySelectorAll<HTMLInputElement>('[data-theme-switch] input')) {
    input.checked = input.value === preference;
  }
}

/** The centre of an element, where the circular reveal starts. */
function centreOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function choose(preference: Preference, origin: { x: number; y: number }) {
  savePreference(preference);

  const changesColours = resolve(preference) !== root.dataset.theme;
  if (!changesColours || !document.startViewTransition || reducedMotion.matches) {
    render(preference);
    return;
  }

  root.dataset.themeSwitching = '';
  const transition = document.startViewTransition(() => render(preference));

  transition.ready
    .then(() => {
      const { x, y } = origin;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {
      // The transition was skipped; the theme has still changed.
    });

  transition.finished.finally(() => {
    delete root.dataset.themeSwitching;
  });
}

export function initTheme() {
  render(readPreference());

  for (const toggle of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    toggle.addEventListener('click', () => {
      choose(root.dataset.theme === 'dark' ? 'light' : 'dark', centreOf(toggle));
    });
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('[data-theme-switch] input')) {
    input.addEventListener('change', () => {
      if (input.checked) choose(input.value as Preference, centreOf(input.closest('label') ?? input));
    });
  }

  // Follow the system while the visitor has not chosen a theme.
  systemDark.addEventListener('change', () => {
    if (readPreference() === 'system') render('system');
  });

  // Keep other open tabs, and pages restored from the back/forward cache, in step.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) render(readPreference());
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) render(readPreference());
  });
}

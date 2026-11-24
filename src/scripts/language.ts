/**
 * Suggests the page in the visitor's language (LanguageSuggestion.astro). Shown only when the first
 * of the browser's preferred languages that the site supports differs from the page's. Dismissing
 * it, or picking a language anywhere on the site, stops further suggestions.
 */

const STORAGE_KEY = 'language-chosen';

/**
 * Maps a browser language tag to a site locale: de-AT -> de, ckb-IQ -> ckb, ku-Arab -> ckb, prs ->
 * fa.
 */
function siteLanguage(tag: string, supported: string[]): string | undefined {
  const lower = tag.toLowerCase();
  if (lower === 'ku-arab' || lower.startsWith('ku-arab-') || lower.startsWith('ckb')) return 'ckb';
  if (lower.startsWith('kmr')) return 'ku';
  // Dari (Afghan Persian).
  if (lower.startsWith('prs')) return 'fa';
  const base = lower.split('-')[0];
  return supported.find((code) => code === base);
}

function remember() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Without storage, the suggestion may reappear on the next page.
  }
}

/**
 * The language menu lists Sorani and Arabic in Arabic script, whose font is only loaded when Arabic
 * text renders. On other pages, preload it as soon as the user reaches for the menu so it opens
 * fully rendered.
 */
export function initLanguageMenu() {
  if (document.documentElement.dir === 'rtl' || !document.fonts) return;
  const warm = () => void document.fonts.load('1em "Vazirmatn Variable"', 'ع').catch(() => {});
  for (const button of document.querySelectorAll('.language__button, .menu-button')) {
    for (const type of ['pointerenter', 'focus', 'touchstart']) {
      button.addEventListener(type, warm, { once: true, passive: true });
    }
  }
}

export function initLanguageSuggestion() {
  // Choosing a language anywhere counts as a decision.
  for (const link of document.querySelectorAll('[data-language-link], .language__link')) {
    link.addEventListener('click', remember);
  }

  const box = document.querySelector<HTMLElement>('[data-language-suggestion]');
  if (!box) return;

  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch {
    // Continue: the suggestion still works without storage.
  }

  const current = document.documentElement.lang;
  const cards = [...box.querySelectorAll<HTMLElement>('[data-locale]')];
  const supported = [current, ...cards.map((card) => card.dataset.locale ?? '')];

  const preferred = (navigator.languages?.length ? navigator.languages : [navigator.language])
    .map((tag) => siteLanguage(tag, supported))
    .find(Boolean);
  if (!preferred || preferred === current) return;

  const card = cards.find((item) => item.dataset.locale === preferred);
  if (!card) return;

  card.hidden = false;
  box.hidden = false;
  // Next frame, so the enter transition runs.
  requestAnimationFrame(() => requestAnimationFrame(() => box.toggleAttribute('data-visible', true)));

  card.querySelector('[data-language-suggestion-dismiss]')?.addEventListener('click', () => {
    remember();
    box.toggleAttribute('data-visible', false);
    window.setTimeout(() => (box.hidden = true), 700);
  });
}

/**
 * Text that arrives, for paragraphs and labels below the fold:
 *
 * - Lines (`data-lines`): as a paragraph comes into view it is split into its
 *   lines, each line rises from behind its own mask one after another, and
 *   then the paragraph is put back exactly as it was, so it reflows and reads
 *   normally afterwards. Words are found with Intl.Segmenter, so this works in
 *   every language, right to left included.
 * - Decoding labels (`.eyebrow`, Latin script): the letters run through random
 *   characters and settle, left to right, as the label appears. A visually
 *   hidden copy keeps the real text for screen readers throughout.
 *
 * Nothing runs when reduced motion is preferred. Spans are created with the
 * DOM API; no HTML is written.
 */

import { enteredFromAbove } from './motion';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const belowFold = (element: Element) => element.getBoundingClientRect().top > window.innerHeight;

/* -------------------------------------------------------------------------- */
/* Lines                                                                      */
/* -------------------------------------------------------------------------- */

function splitIntoLines(paragraph: HTMLElement) {
  const text = paragraph.textContent ?? '';
  const locale = paragraph.closest('[lang]')?.getAttribute('lang') ?? undefined;
  const segments = [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)];

  // Each word with the spaces that follow it, measured where it falls.
  const words: HTMLSpanElement[] = [];
  for (const { segment, isWordLike } of segments) {
    const previous = words[words.length - 1];
    if (!isWordLike && previous) previous.textContent += segment;
    else {
      const span = document.createElement('span');
      span.textContent = segment;
      words.push(span);
    }
  }
  paragraph.replaceChildren(...words);

  const lines: string[] = [];
  let top = Number.NaN;
  for (const word of words) {
    if (word.offsetTop !== top) {
      lines.push('');
      top = word.offsetTop;
    }
    lines[lines.length - 1] += word.textContent;
  }

  const inners = lines.map((line) => {
    const mask = document.createElement('span');
    mask.className = 'line';
    const inner = document.createElement('span');
    inner.className = 'line__inner';
    inner.textContent = line.trimEnd();
    mask.append(inner);
    return { mask, inner };
  });
  paragraph.replaceChildren(...inners.map(({ mask }) => mask));
  return { text, inners: inners.map(({ inner }) => inner) };
}

function initLines() {
  const paragraphs = [...document.querySelectorAll<HTMLElement>('[data-lines]')].filter(
    // Plain text only, so nothing inside (a link) is lost.
    (paragraph) => paragraph.children.length === 0 && belowFold(paragraph),
  );
  if (paragraphs.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const paragraph = entry.target as HTMLElement;
        observer.unobserve(paragraph);
        if (enteredFromAbove(entry)) {
          paragraph.dataset.lines = 'done';
          continue;
        }
        paragraph.dataset.lines = 'active';
        const { text, inners } = splitIntoLines(paragraph);
        const animations = inners.map((inner, index) =>
          inner.animate([{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], {
            duration: 1000,
            delay: index * 90,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'backwards',
          }),
        );
        Promise.all(animations.map((animation) => animation.finished))
          .catch(() => {})
          .finally(() => {
            paragraph.textContent = text;
            paragraph.dataset.lines = 'done';
          });
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );

  for (const paragraph of paragraphs) {
    paragraph.dataset.lines = 'pending';
    observer.observe(paragraph);
  }
}

/* -------------------------------------------------------------------------- */
/* Decoding labels                                                            */
/* -------------------------------------------------------------------------- */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>=';
const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}]+$/u;

function decode(label: HTMLElement) {
  const text = label.textContent ?? '';
  const hidden = document.createElement('span');
  hidden.className = 'visually-hidden';
  hidden.textContent = text;
  const shown = document.createElement('span');
  shown.setAttribute('aria-hidden', 'true');
  label.replaceChildren(hidden, shown);

  const characters = [...text];
  const duration = 500 + characters.length * 22;
  const start = performance.now();
  // Each letter settles at its own moment, roughly left to right.
  const settles = characters.map((_, index) => (index / characters.length) * 0.7 + Math.random() * 0.3);

  const step = (now: number) => {
    const progress = (now - start) / duration;
    if (progress >= 1) {
      label.textContent = text;
      return;
    }
    shown.textContent = characters
      .map((character, index) =>
        /\s/.test(character) || progress >= settles[index] ? character : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      )
      .join('');
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initDecoding() {
  const labels = [...document.querySelectorAll<HTMLElement>('.eyebrow')].filter(
    (label) => label.children.length === 0 && LATIN.test(label.textContent ?? '') && belowFold(label),
  );
  if (labels.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (!enteredFromAbove(entry)) decode(entry.target as HTMLElement);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const label of labels) observer.observe(label);
}

export function initText() {
  if (reduced() || !('IntersectionObserver' in window) || !('Segmenter' in Intl)) return;
  initLines();
  initDecoding();
}

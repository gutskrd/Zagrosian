/**
 * What only a mouse or trackpad uses: smooth wheel scrolling (Lenis), the
 * custom cursor and the magnetic buttons. site.ts loads this separately, and
 * only on such devices, so phones and tablets never download it.
 */
import { initCursor } from './cursor';
import { initMagnetic } from './magnetic';
import { initSmoothScroll } from './smooth';

export function initDesktop() {
  initCursor();
  initMagnetic();
  initSmoothScroll();
}

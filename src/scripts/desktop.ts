/**
 * What only a mouse or trackpad uses: smooth wheel scrolling (Lenis), the
 * custom cursor, the magnetic buttons and the water the pointer stirs.
 * site.ts loads this separately, and only on such devices, so phones and
 * tablets never download it.
 */
import { initCursor } from './cursor';
import { initMagnetic } from './magnetic';
import { initSmoothScroll } from './smooth';
import { initWater } from './water';

export function initDesktop() {
  initCursor();
  initMagnetic();
  initSmoothScroll();
  initWater();
}

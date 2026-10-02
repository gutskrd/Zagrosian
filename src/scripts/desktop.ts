/**
 * What only a mouse or trackpad uses: the custom cursor and the magnetic
 * buttons. site.ts loads this separately, and only on such devices, so phones
 * and tablets never download it. (Scrolling is the browser's own, which
 * follows the hand at once.)
 */
import { initCursor } from './cursor';
import { initMagnetic } from './magnetic';

export function initDesktop() {
  initCursor();
  initMagnetic();
}

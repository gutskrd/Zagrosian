/**
 * A phone or computer with little to spare: four cores or fewer, or 4 GB of
 * memory or less (where the browser says). The drawn scenes (the rug, the
 * paper plane) draw fewer pixels on it, so they stay smooth.
 */
export const modest = () =>
  (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

/** How many pixels to draw for each CSS pixel: the screen's, up to 2, or 1.5 on a modest device. */
export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, modest() ? 1.5 : 2);

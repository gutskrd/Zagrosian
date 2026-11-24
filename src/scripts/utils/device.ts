/**
 * Low-end device heuristic: 4 or fewer cores, or 4 GB of memory or less (where `deviceMemory` is
 * exposed). Canvas scenes (rug, paper plane) render at a lower pixel ratio there to stay smooth.
 */
export const modest = () =>
  (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

/** Device pixel ratio to render at: the screen's, capped at 2 (1.5 on low-end devices). */
export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, modest() ? 1.5 : 2);

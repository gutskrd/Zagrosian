/** Numeric helpers for the animation code. */

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** Linear interpolation from `from` to `to`. */
export const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/** Hermite smoothstep: 0 up to `from`, 1 from `to`, eased in between. */
export const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

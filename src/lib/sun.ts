/**
 * The sun from the Kurdish flag (src/assets/brand/sun-black-source.png): 21 straight rays, one
 * pointing up, with the gaps at 51.2% of the ray length (measured from the artwork). Generated from
 * the geometry rather than traced, so the points are exact. SVG path in a -100..100 box that the
 * ray tips touch.
 */
export const sunOutline = (scale = 1) =>
  `M${Array.from({ length: 42 }, (_, index) => {
    const angle = (index * Math.PI) / 21;
    const radius = (index % 2 ? 51.2 : 100) * scale;
    return `${(Math.sin(angle) * radius).toFixed(2)} ${(-Math.cos(angle) * radius).toFixed(2)}`;
  }).join('L')}Z`;

export const sunPath = sunOutline();

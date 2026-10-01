/**
 * The sun of the Kurdish flag, as in src/assets/brand/sun-black-source.png:
 * 21 straight rays, one pointing up, the gaps between them at 51.2% of the
 * rays' length (measured on the artwork). Drawn from that geometry rather than
 * traced, so its points are exact. A path in a box from -100 to 100, which the
 * rays' tips touch.
 */
export const sunPath = `M${Array.from({ length: 42 }, (_, index) => {
  const angle = (index * Math.PI) / 21;
  const radius = index % 2 ? 51.2 : 100;
  return `${(Math.sin(angle) * radius).toFixed(2)} ${(-Math.cos(angle) * radius).toFixed(2)}`;
}).join('L')}Z`;

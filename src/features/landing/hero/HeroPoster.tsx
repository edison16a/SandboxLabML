/**
 * Still frames of the hero's live scenes, captured from the real renderer
 * by scripts/capture-hero-poster.mjs. Wide screens pick one by the width
 * it is drawn at and show the scenes side by side; portrait screens,
 * phones and tablets alike, get a portrait frame with them stacked.
 */
export const POSTER = {
  wide: [
    { src: '/hero/poster-1280.webp', width: 1280 },
    { src: '/hero/poster-1920.webp', width: 1920 },
    { src: '/hero/poster-2560.webp', width: 2560 },
  ],
  portrait: '/hero/poster-portrait.webp',
} as const;

/**
 * The width the wide poster is drawn at. It covers the hero, which is a
 * screen tall, so a window taller than 16:9 draws it wider than the
 * window, and the browser must pick the file for that width, not 100vw.
 */
const WIDE_SIZES = 'max(100vw, calc((100vh - 3rem) * 16 / 9))';

/**
 * The hero's first paint: a still of the live scenes, sent with high
 * priority as plain HTML so it shows before any script runs. Each live
 * scene, when it comes, fades in over its half. The frame is centered, so
 * the line between the two scenes stays in the middle however the window
 * crops it, where the live scenes split too.
 */
export function HeroPoster() {
  return (
    <picture>
      <source media="(orientation: portrait)" srcSet={POSTER.portrait} type="image/webp" />
      {/* A plain img: these files are already sized and compressed, and the page must not depend on an image server. */}
      <img
        src={POSTER.wide[1].src}
        srcSet={POSTER.wide.map((p) => `${p.src} ${p.width}w`).join(', ')}
        sizes={WIDE_SIZES}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </picture>
  );
}

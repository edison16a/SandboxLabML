/**
 * The app's own mark (LogoMark in src/ui/brand/Logo.tsx) as a signed
 * distance in GLSL, for the faint emblems engraved into a few floor tiles.
 * Drawn as a distance field rather than a texture, so its outline stays
 * crisp from a close up to the whole grid. Coordinates are the SVG's own
 * 28 by 28 view box, y down: two bonds 2 units wide and three atoms.
 * Keep it in step with the SVG if the mark ever changes.
 */
export const EMBLEM_GLSL = /* glsl */ `
float hsSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float hsEmblem(vec2 p) {
  float d = min(hsSegment(p, vec2(6.0, 20.0), vec2(14.0, 8.0)), hsSegment(p, vec2(14.0, 8.0), vec2(22.0, 20.0))) - 1.0;
  d = min(d, length(p - vec2(6.0, 20.0)) - 3.0);
  d = min(d, length(p - vec2(22.0, 20.0)) - 3.0);
  return min(d, length(p - vec2(14.0, 8.0)) - 3.5);
}
`;

/** Share of tiles that carry the emblem. Rare enough to read as a detail, not a pattern. */
export const EMBLEM_SHARE = 0.05;
/** Width of the emblem as a share of its tile. */
export const EMBLEM_SIZE = 0.6;

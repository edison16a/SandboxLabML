/**
 * The foliage atlas is one texture of 4 by 2 tiles, so every tree, shrub
 * and trunk in the world draws with a single material. Pure layout, no
 * drawing, so the geometry builders can pick tiles in Node too.
 */
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 2;

export const TILE = {
  /** Dense pine needle tufts, and lighter sparser ones for the tips. */
  needles: 0,
  needleTips: 1,
  /** Broadleaf foliage, a deep and a sunlit mix. */
  leaves: 2,
  leavesLight: 3,
  /** Low scrub: small sage green leaves, and dry twiggy brush. */
  scrub: 4,
  brush: 5,
  /** Opaque bark: furrowed red brown pine bark and smoother grey bark. */
  pineBark: 6,
  greyBark: 7,
} as const;

/** A tile's rectangle in UV space: u0, v0, u1, v1, inset half a texel's worth so neighbors never bleed in. */
export function tileRect(tile: number, inset = 0.004): [number, number, number, number] {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  // Canvas rows run top down, UV v runs bottom up.
  const u0 = col / ATLAS_COLS + inset;
  const u1 = (col + 1) / ATLAS_COLS - inset;
  const v1 = 1 - row / ATLAS_ROWS - inset;
  const v0 = 1 - (row + 1) / ATLAS_ROWS + inset;
  return [u0, v0, u1, v1];
}

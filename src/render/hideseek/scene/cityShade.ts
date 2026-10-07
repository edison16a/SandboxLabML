import type { BackdropBlock } from './backdropBlocks';

/** Share of the tone range a block's own random shade may take: small, so the city reads as one material. */
export const TONE_SPREAD = 0.2;
/** Share of the tone range the baked occlusion may add to a block sunk among taller ones. */
const SUNK = 0.55;

/**
 * Bakes a cheap ambient occlusion into each block's tone: a block shorter
 * than the blocks round it sits in a pit that sees less sky, so it is
 * drawn darker, and a block standing over its neighbors keeps its light
 * tone. Heights go into a coarse lattice once (the city is rebuilt only
 * when the grid changes size), then each block reads the lattice just
 * past the middle of its four sides. This is what gives the city depth
 * from a distance, like stacked cubes under a soft sky, rather than a
 * speckle of random greys.
 */
export function bakeOcclusion(blocks: BackdropBlock[], cell: number): void {
  const heights = new Map<number, number>();
  const key = (x: number, z: number) => Math.floor(x / cell) * 65536 + Math.floor(z / cell);
  for (const b of blocks) {
    for (let x = b.x - b.w / 2 + cell / 2; x < b.x + b.w / 2; x += cell) {
      for (let z = b.z - b.d / 2 + cell / 2; z < b.z + b.d / 2; z += cell) {
        const k = key(x, z);
        heights.set(k, Math.max(heights.get(k) ?? 0, b.h));
      }
    }
  }
  for (const b of blocks) {
    const ox = b.w / 2 + cell * 0.6;
    const oz = b.d / 2 + cell * 0.6;
    const around = ((heights.get(key(b.x + ox, b.z)) ?? 0) + (heights.get(key(b.x - ox, b.z)) ?? 0) + (heights.get(key(b.x, b.z + oz)) ?? 0) + (heights.get(key(b.x, b.z - oz)) ?? 0)) / 4;
    const sunk = Math.min(1, Math.max(0, (around - b.h) / Math.max(1.5, around)));
    b.tone = Math.min(0.999, b.tone * TONE_SPREAD + sunk * SUNK);
  }
}

import type * as THREE from 'three';
import { hash, pixelTexture } from './pixels';

/** How many times the tile repeats around the disc. */
export const DISC_REPEAT = 16;

/**
 * A carbon ceramic brake disc face: mottled dark grey with a staggered
 * spiral of drilled holes. U runs around the disc and V across it, as the
 * lathe lays its UVs. Holes are drawn as ellipses in the tile so they come
 * out round on the disc, where one tile is wider than it is tall.
 */
export function discMap(size: number): THREE.DataTexture {
  const holes = [
    [0.18, 0.28],
    [0.5, 0.5],
    [0.82, 0.72],
  ];
  const rx = 0.07;
  const ry = 0.045;
  return pixelTexture(size, true, (x, y, out) => {
    const u = (x + 0.5) / size;
    const v = (y + 0.5) / size;
    // Coarse and fine noise mixed, for the mottled look of the ceramic matrix.
    const coarse = hash(Math.floor(x / 6), Math.floor(y / 6), 11);
    const fine = hash(x, y, 12);
    let c = 52 + coarse * 18 + fine * 10;
    for (const [hu, hv] of holes) {
      const d = ((u - hu) / rx) ** 2 + ((v - hv) / ry) ** 2;
      if (d < 1) c = 14;
      else if (d < 1.5) c *= 0.75;
    }
    out[0] = c;
    out[1] = c;
    out[2] = c + 2;
  });
}

import type * as THREE from 'three';
import { hash, packNormal, pixelTexture } from './pixels';

/**
 * A normal map of tiny metallic flakes for car paint. Each flake is a cell
 * of a jittered grid (nearest feature point, wrapped so the tile repeats)
 * tilted a random way. Under a smooth clear coat this gives the sparkle
 * that makes paint read as metallic up close, and averages out to a soft
 * sheen at a distance through the mipmaps.
 */
export function flakeNormalMap(size: number): THREE.DataTexture {
  const cell = 3;
  const cells = Math.floor(size / cell);
  const tilt = 0.32;
  // Every texel checks nine cells, so each cell's feature point is hashed once up front instead of nine times over.
  let points: Float64Array | undefined;
  return pixelTexture('flakes', size, false, (x, y, out) => {
    points ??= featurePoints(cells);
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    // The winning cell is kept as two numbers, not an array, so the loop over every texel does not allocate.
    let best = Infinity;
    let idx = 0;
    let idy = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx;
        const gy = cy + dy;
        const wx = ((gx % cells) + cells) % cells;
        const wy = ((gy % cells) + cells) % cells;
        const k = (wy * cells + wx) * 2;
        const fx = (gx + points[k]) * cell;
        const fy = (gy + points[k + 1]) * cell;
        const d = (fx - x - 0.5) ** 2 + (fy - y - 0.5) ** 2;
        if (d < best) {
          best = d;
          idx = wx;
          idy = wy;
        }
      }
    }
    const a = hash(idx, idy, 3) * Math.PI * 2;
    const r = tilt * Math.sqrt(hash(idx, idy, 4));
    packNormal(Math.cos(a) * r, Math.sin(a) * r, out);
  });
}

/** Where each cell's feature point sits inside it, as (x, y) pairs from 0 to 1. */
function featurePoints(cells: number): Float64Array {
  const out = new Float64Array(cells * cells * 2);
  for (let wy = 0; wy < cells; wy++) {
    for (let wx = 0; wx < cells; wx++) {
      out[(wy * cells + wx) * 2] = hash(wx, wy, 1);
      out[(wy * cells + wx) * 2 + 1] = hash(wx, wy, 2);
    }
  }
  return out;
}

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
  return pixelTexture(size, false, (x, y, out) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    let best = Infinity;
    let id = [0, 0];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx;
        const gy = cy + dy;
        const wx = ((gx % cells) + cells) % cells;
        const wy = ((gy % cells) + cells) % cells;
        const fx = (gx + hash(wx, wy, 1)) * cell;
        const fy = (gy + hash(wx, wy, 2)) * cell;
        const d = (fx - x - 0.5) ** 2 + (fy - y - 0.5) ** 2;
        if (d < best) {
          best = d;
          id = [wx, wy];
        }
      }
    }
    const a = hash(id[0], id[1], 3) * Math.PI * 2;
    const r = tilt * Math.sqrt(hash(id[0], id[1], 4));
    packNormal(Math.cos(a) * r, Math.sin(a) * r, out);
  });
}

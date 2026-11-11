import * as THREE from 'three';
import type { Rng } from '@/engine/core/rng';
import type { FoliageBuilder } from './foliageBuilder';

/**
 * Fills an ellipsoid crown with foliage cards, most of them near its
 * surface where the light is, a few deeper in so the crown never looks
 * hollow. Each card's normal is the ellipsoid's normal at its spot, so the
 * whole crown shades as one soft volume, and cards deep inside or low on
 * the shaded underside get darker. `floor` (0 to 1) trims the bottom of the
 * ellipsoid for flat bottomed canopies.
 */
export function crownCloud(
  b: FoliageBuilder,
  rng: Rng,
  center: THREE.Vector3,
  radii: THREE.Vector3,
  count: number,
  size: [number, number],
  tiles: readonly number[],
  floor = 1,
): void {
  const d = new THREE.Vector3();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 20; tries++) {
    // A random direction, then a depth skewed toward the surface.
    d.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
    const len = d.length();
    if (len > 1 || len < 1e-3) continue;
    d.divideScalar(len);
    if (d.y < -floor) continue;
    const depth = 0.6 + 0.4 * Math.sqrt(rng.next());
    p.set(center.x + d.x * radii.x * depth, center.y + d.y * radii.y * depth, center.z + d.z * radii.z * depth);
    n.set(d.x / radii.x, d.y / radii.y, d.z / radii.z);
    const shade = (0.45 + 0.55 * (depth - 0.6) / 0.4) * (0.75 + 0.25 * (d.y * 0.5 + 0.5));
    b.card(p, rng.range(size[0], size[1]), tiles[rng.int(tiles.length)], rng.range(0, Math.PI * 2), n, Math.min(1, shade + 0.15));
    placed++;
  }
}

import type { Rect } from '@/engine/hideseek/layouts/types';
import { BOX_COUNT, boxSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { rayAabb, rayBox } from '@/engine/hideseek/sensing/raycast2d';
import { boxAt } from '../frame/snapshotRead';

const HALF = Array.from({ length: BOX_COUNT }, (_, i) => {
  const s = boxSize(DEFAULT_HIDESEEK_PHYSICS, i);
  return [s.length / 2, s.width / 2];
});

/**
 * Distance from (x, z) along the unit direction (dx, dz) to the first wall
 * or box of an arena, capped at `max`. Walls and boxes are full height
 * prisms at sight height, so this 2D cast agrees with the engine's Rapier
 * sight lines; it only drives visuals, never a result.
 */
export function castSight(walls: Rect[], snap: Float32Array, arena: number, x: number, z: number, dx: number, dz: number, max: number): number {
  let best = max;
  for (let w = 0; w < walls.length; w++) {
    const r = walls[w];
    const t = rayAabb(x, z, dx, dz, r.x, r.z, r.hx, r.hz);
    if (t < best) best = t;
  }
  for (let b = 0; b < BOX_COUNT; b++) {
    const o = boxAt(arena, b);
    const yaw = snap[o + 2];
    const t = rayBox(x, z, dx, dz, snap[o], snap[o + 1], HALF[b][0], HALF[b][1], Math.cos(yaw), Math.sin(yaw));
    if (t < best) best = t;
  }
  return best;
}

/** True when nothing blocks the straight line between two floor points. */
export function sightClear(walls: Rect[], snap: Float32Array, arena: number, x0: number, z0: number, x1: number, z1: number): boolean {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 1e-6) return true;
  return castSight(walls, snap, arena, x0, z0, (x1 - x0) / len, (z1 - z0) / len, len) >= len - 1e-4;
}

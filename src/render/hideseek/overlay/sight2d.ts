import type { Rect } from '@/engine/hideseek/layouts/types';
import { BOX_COUNT, BOX_KINDS, boxSlice, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { BOX_X, BOX_YAW, BOX_Z, FLAG_CLIMBING } from '@/engine/hideseek/snapshot';
import { rayAabb, rayBox } from '@/engine/hideseek/sensing/raycast2d';
import { agentAt, agentElevation, agentFlags, boxAt, hasFlag } from '../frame/snapshotRead';

const P = DEFAULT_HIDESEEK_PHYSICS;
/** The sight slice of each arena box: what of it stands taller than sight height (all of a crate, the high end of a ramp). */
const SLICES = Array.from({ length: BOX_COUNT }, (_, i) => boxSlice(P, BOX_KINDS[i]));

/**
 * How boxes treat a sight line, from the engine's rules: `over` when an end
 * stands high enough to see over boxes (only walls block then), `ramps`
 * when an end is on a ramp. An arena has a single ramp, so that ramp is
 * the one a climber stands on, and sight passes through it.
 */
export const SIGHT_ALL = 0;
export const SIGHT_SKIP_RAMPS = 1;
export const SIGHT_OVER_BOXES = 2;

/**
 * Distance from (x, z) along the unit direction (dx, dz) to the first wall
 * or box of an arena, capped at `max`. Walls and box slices are prisms at
 * sight height, so this 2D cast agrees with the engine's Rapier sight
 * lines; it only drives visuals, never a result. `mode` is SIGHT_ALL or
 * one of the other modes above.
 */
export function castSight(walls: Rect[], snap: Float32Array, arena: number, x: number, z: number, dx: number, dz: number, max: number, mode = SIGHT_ALL): number {
  let best = max;
  for (let w = 0; w < walls.length; w++) {
    const r = walls[w];
    const t = rayAabb(x, z, dx, dz, r.x, r.z, r.hx, r.hz);
    if (t < best) best = t;
  }
  if (mode === SIGHT_OVER_BOXES) return best;
  for (let b = 0; b < BOX_COUNT; b++) {
    if (mode === SIGHT_SKIP_RAMPS && BOX_KINDS[b] === 'ramp') continue;
    const o = boxAt(arena, b);
    const s = SLICES[b];
    const yaw = snap[o + BOX_YAW];
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const t = rayBox(x, z, dx, dz, snap[o + BOX_X] + s.offset * cos, snap[o + BOX_Z] - s.offset * sin, s.hx, s.hz, cos, sin);
    if (t < best) best = t;
  }
  return best;
}

/** True when nothing blocks the straight line between two floor points. */
export function sightClear(walls: Rect[], snap: Float32Array, arena: number, x0: number, z0: number, x1: number, z1: number, mode = SIGHT_ALL): boolean {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 1e-6) return true;
  return castSight(walls, snap, arena, x0, z0, (x1 - x0) / len, (z1 - z0) / len, len, mode) >= len - 1e-4;
}

/** The sight mode for a line from agent `from` of an arena, to agent `to` when given (see SIGHT_ALL). */
export function sightMode(snap: Float32Array, arena: number, from: number, to = from): number {
  const a = agentAt(arena, from);
  const b = agentAt(arena, to);
  const high = P.climb.seeOverBoxes;
  if (agentElevation(snap, a) >= high || agentElevation(snap, b) >= high) return SIGHT_OVER_BOXES;
  return hasFlag(agentFlags(snap, a), FLAG_CLIMBING) || hasFlag(agentFlags(snap, b), FLAG_CLIMBING) ? SIGHT_SKIP_RAMPS : SIGHT_ALL;
}

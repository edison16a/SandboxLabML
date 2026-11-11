import { lerp, lerpAngle } from '@/engine/core/math';
import { NAVIGATION_SNAPSHOT, SNAP_X, SNAP_YAW, SNAP_Z, WORLD_HEADER, WORLD_MOVER_COUNT, WORLD_TIME } from '@/engine/navigation/snapshot';
import type { FloorPose } from './navFrame';

export const STRIDE = NAVIGATION_SNAPSHOT.stride;

/** A jump this long between two snapshots is a teleport (a new episode), m: it is shown, not blended. */
const TELEPORT = 2.5;

/** Agent i's pose blended between two snapshots. A jump, or no previous snapshot, reads the latest as is. */
export function blendAgent(prev: Float32Array | null, curr: Float32Array, i: number, alpha: number, out: FloorPose): FloorPose {
  const o = i * STRIDE;
  const x1 = curr[o + SNAP_X];
  const z1 = curr[o + SNAP_Z];
  if (!prev || prev.length <= o + SNAP_YAW || Math.abs(prev[o + SNAP_X] - x1) + Math.abs(prev[o + SNAP_Z] - z1) > TELEPORT) {
    out.x = x1;
    out.z = z1;
    out.yaw = curr[o + SNAP_YAW];
    return out;
  }
  out.x = lerp(prev[o + SNAP_X], x1, alpha);
  out.z = lerp(prev[o + SNAP_Z], z1, alpha);
  out.yaw = lerpAngle(prev[o + SNAP_YAW], curr[o + SNAP_YAW], alpha);
  return out;
}

/** The episode clock blended between two world blocks, s. */
export function blendTime(prev: Float32Array | null, curr: Float32Array | null, alpha: number): number {
  if (!curr) return 0;
  const t1 = curr[WORLD_TIME];
  if (!prev || prev[WORLD_TIME] > t1) return t1;
  return lerp(prev[WORLD_TIME], t1, alpha);
}

/** Every mover's position blended between two world blocks, into `out` as x, z pairs. Returns the mover count. */
export function blendMovers(prev: Float32Array | null, curr: Float32Array | null, alpha: number, out: Float32Array): number {
  if (!curr) return 0;
  const n = Math.min(curr[WORLD_MOVER_COUNT], out.length / 2);
  const blend = prev !== null && prev[WORLD_MOVER_COUNT] === n && prev[WORLD_TIME] <= curr[WORLD_TIME];
  for (let k = 0; k < n * 2; k++) {
    const v = curr[WORLD_HEADER + k];
    out[k] = blend ? lerp((prev as Float32Array)[WORLD_HEADER + k], v, alpha) : v;
  }
  return n;
}

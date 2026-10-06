import { lerp, lerpAngle } from '@/engine/core/math';
import { HIDESEEK_SNAPSHOT, SNAPSHOT_AGENTS_AT, SNAPSHOT_BOXES_AT, SNAPSHOT_ENTRY } from '@/engine/hideseek/snapshot';

/** Floats per arena in the arena stream. */
export const STRIDE = HIDESEEK_SNAPSHOT.stride;

/** A pose on the floor plane. Yaw follows the engine and three.js rotation.y alike. */
export interface FloorPose {
  x: number;
  z: number;
  yaw: number;
}

/** Offset of agent `agent` (0 hider, 1 seeker) of arena `arena`. */
export function agentAt(arena: number, agent: number): number {
  return arena * STRIDE + SNAPSHOT_AGENTS_AT + agent * SNAPSHOT_ENTRY;
}

/** Offset of box `box` (0 and 1 cubes, 2 and 3 planks) of arena `arena`. */
export function boxAt(arena: number, box: number): number {
  return arena * STRIDE + SNAPSHOT_BOXES_AT + box * SNAPSHOT_ENTRY;
}

/** A jump this long between two frames is a teleport (a Sandbox drag), drawn without blending, m. */
const TELEPORT = 2;

/**
 * Blends a pose between two frames, 30 Hz snapshots drawn at 60 Hz. Yaw
 * takes the short way round, like a quaternion slerp about one axis.
 * Allocates nothing; the caller owns `out`.
 */
export function blendFloorPose(prev: Float32Array | null, curr: Float32Array, o: number, alpha: number, out: FloorPose): FloorPose {
  if (!prev || prev.length <= o + 2 || Math.abs(prev[o] - curr[o]) + Math.abs(prev[o + 1] - curr[o + 1]) > TELEPORT) {
    out.x = curr[o];
    out.z = curr[o + 1];
    out.yaw = curr[o + 2];
    return out;
  }
  out.x = lerp(prev[o], curr[o], alpha);
  out.z = lerp(prev[o + 1], curr[o + 1], alpha);
  out.yaw = lerpAngle(prev[o + 2], curr[o + 2], alpha);
  return out;
}

/** Whether a flag bit (FLAG_SEEN and friends) is set in a flags float. */
export function hasFlag(flags: number, bit: number): boolean {
  return (flags & bit) !== 0;
}

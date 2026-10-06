import { lerp, lerpAngle } from '@/engine/core/math';
import {
  AGENT_ELEVATION,
  AGENT_FLAGS,
  BOX_LOCK,
  HIDESEEK_SNAPSHOT,
  LOCK_FREE,
  SNAPSHOT_PHASE,
  SNAPSHOT_SEEN,
  SNAPSHOT_TIME,
  snapshotAgentAt,
  snapshotBoxAt,
} from '@/engine/hideseek/snapshot';

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
  return snapshotAgentAt(agent, arena * STRIDE);
}

/** Offset of box `box` of arena `arena`. Its kind is BOX_KINDS[box]. */
export function boxAt(arena: number, box: number): number {
  return snapshotBoxAt(box, arena * STRIDE);
}

/** Flags (FLAG_SEEN and friends) of the agent at offset `o`, from agentAt. */
export const agentFlags = (buf: Float32Array, o: number): number => buf[o + AGENT_FLAGS];

/** Elevation of the agent at offset `o` above the floor, m. */
export const agentElevation = (buf: Float32Array, o: number): number => buf[o + AGENT_ELEVATION];

/** Lock of the box at offset `o`, from boxAt: LOCK_FREE, LOCK_HIDERS or LOCK_SEEKERS. */
export const boxLock = (buf: Float32Array, o: number): number => buf[o + BOX_LOCK];

/** Whether the box at offset `o` is locked by either team. */
export const boxLocked = (buf: Float32Array, o: number): boolean => buf[o + BOX_LOCK] !== LOCK_FREE;

/** Match time of arena `arena`, s. */
export const arenaTime = (buf: Float32Array, arena: number): number => buf[arena * STRIDE + SNAPSHOT_TIME];

/** Whether arena `arena` is still in the prep phase. */
export const arenaInPrep = (buf: Float32Array, arena: number): boolean => buf[arena * STRIDE + SNAPSHOT_PHASE] === 1;

/** Whether the seeker of arena `arena` sees the hider. */
export const arenaHiderSeen = (buf: Float32Array, arena: number): boolean => buf[arena * STRIDE + SNAPSHOT_SEEN] === 1;

/** A jump this long between two frames is a teleport (a Sandbox drag), drawn without blending, m. */
const TELEPORT = 2;

/**
 * Blends a pose between two frames, 30 Hz snapshots drawn at 60 Hz. Yaw
 * takes the short way round, like a quaternion slerp about one axis.
 * Agents and boxes both start with x, z and yaw, so `o` may be either.
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

import type { NavAgent } from './agent';
import { SNAP_FLAGS, SNAP_PROGRESS, SNAP_SPEED, SNAP_STATUS, SNAP_STOP_TIME, SNAP_X, SNAP_YAW, SNAP_Z } from './snapshot';

/** Writes one agent's snapshot record at offset `o`. Field by field, so streaming 100 agents allocates nothing. */
export function writeAgentSnapshot(a: NavAgent, out: Float32Array, o: number): void {
  out[o + SNAP_X] = a.x;
  out[o + SNAP_Z] = a.z;
  out[o + SNAP_YAW] = a.yaw;
  out[o + SNAP_SPEED] = a.speed;
  out[o + SNAP_STATUS] = a.status;
  out[o + SNAP_PROGRESS] = a.progress;
  out[o + SNAP_FLAGS] = a.flags;
  out[o + SNAP_STOP_TIME] = a.stopTime;
}

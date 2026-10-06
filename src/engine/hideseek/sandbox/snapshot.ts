import type { BoxKind } from '../boxKinds';
import {
  AGENT_ELEVATION,
  AGENT_FLAGS,
  AGENT_X,
  AGENT_YAW,
  AGENT_Z,
  BOX_X,
  BOX_YAW,
  BOX_Z,
  FLAG_AIRBORNE,
  FLAG_CLIMBING,
  FLAG_FROZEN,
  FLAG_HOLDING,
  FLAG_SEEING,
  FLAG_SEEN,
  type AgentSnapshot,
} from '../snapshot';
import { BOX_LOCKED, sandboxBoxBits, sandboxBoxKind, sandboxBoxLock } from './boxBits';
import type { SandboxState } from './state';

export * from './boxBits';

/**
 * The Sandbox stream. Unlike the fixed arena snapshot, its size depends on
 * how many players and boxes the user picked, so a header says how many of
 * each follow:
 *
 *   header (8): time s, phase (1 prep, 0 seek), any hider seen (0 or 1),
 *               over (0 or 1), hiders, seekers, boxes, hiders seen
 *   per agent (5): x, z, yaw, flags, elevation m, hiders first, at the
 *                  same offsets as an arena agent (AGENT_X and friends)
 *   per box (4): x, z, yaw, bits (see boxBits.ts)
 *
 * The first three header fields match the arena snapshot, so HUD code that
 * reads time, phase and "seen" works on either stream.
 */
export const SANDBOX_HEADER = 8;
export const SANDBOX_AGENT_ENTRY = 5;
export const SANDBOX_BOX_ENTRY = 4;
/** Offset of a box's bits within its entry. */
export const SANDBOX_BOX_BITS = 3;

/** Floats in one Sandbox frame. */
export function sandboxSnapshotLength(agents: number, boxes: number): number {
  return SANDBOX_HEADER + SANDBOX_AGENT_ENTRY * agents + SANDBOX_BOX_ENTRY * boxes;
}

/** Offset of agent `slot` in a frame. */
export function sandboxAgentAt(slot: number): number {
  return SANDBOX_HEADER + slot * SANDBOX_AGENT_ENTRY;
}

/** Offset of box `index` in a frame whose header says `agents` players. */
export function sandboxBoxAt(agents: number, index: number): number {
  return SANDBOX_HEADER + agents * SANDBOX_AGENT_ENTRY + index * SANDBOX_BOX_ENTRY;
}

/** Header counts one at a time, for render loops that run every frame and must not allocate. */
export const sandboxHiderCount = (buf: Float32Array): number => buf[4] | 0;
export const sandboxSeekerCount = (buf: Float32Array): number => buf[5] | 0;
export const sandboxBoxCount = (buf: Float32Array): number => buf[6] | 0;

/** All counts from a frame's header as one object. Allocates, so it is for tests and slow paths. */
export function sandboxCounts(buf: Float32Array): { hiders: number; seekers: number; boxes: number } {
  return { hiders: sandboxHiderCount(buf), seekers: sandboxSeekerCount(buf), boxes: sandboxBoxCount(buf) };
}

/** Writes one frame into a caller-owned buffer of sandboxSnapshotLength floats. Allocates nothing. */
export function writeSandboxSnapshot(s: SandboxState, out: Float32Array): void {
  const n = s.agents.length;
  let seen = 0;
  for (let h = 0; h < s.hiders; h++) if (s.agents[h].seen) seen++;
  out[0] = s.tick * s.physics.dt;
  out[1] = s.tick <= s.prepTicks ? 1 : 0;
  out[2] = seen > 0 ? 1 : 0;
  out[3] = s.tick >= s.totalTicks ? 1 : 0;
  out[4] = s.hiders;
  out[5] = s.seekers;
  out[6] = s.boxes.length;
  out[7] = seen;
  for (let i = 0; i < n; i++) {
    const a = s.agents[i];
    const o = sandboxAgentAt(i);
    const seenFlag = i < s.hiders ? a.seen : s.seenByOpponent[i] === 1;
    out[o + AGENT_X] = a.x;
    out[o + AGENT_Z] = a.z;
    out[o + AGENT_YAW] = a.yaw;
    out[o + AGENT_FLAGS] =
      (a.holding ? FLAG_HOLDING : 0) |
      (a.seesOpponent ? FLAG_SEEING : 0) |
      (seenFlag ? FLAG_SEEN : 0) |
      (a.frozen ? FLAG_FROZEN : 0) |
      (a.climbing ? FLAG_CLIMBING : 0) |
      (a.airborne ? FLAG_AIRBORNE : 0);
    out[o + AGENT_ELEVATION] = a.elevation;
  }
  for (let b = 0; b < s.boxes.length; b++) {
    const box = s.boxes[b];
    const o = sandboxBoxAt(n, b);
    out[o + BOX_X] = box.x;
    out[o + BOX_Z] = box.z;
    out[o + BOX_YAW] = box.yaw;
    out[o + SANDBOX_BOX_BITS] = sandboxBoxBits(box);
  }
}

/** One box of a decoded Sandbox frame. `lock` is an arena lock value (LOCK_FREE and friends). */
export interface SandboxBoxSnapshot {
  x: number;
  z: number;
  yaw: number;
  kind: BoxKind;
  locked: boolean;
  lock: number;
}

/** One Sandbox frame decoded into objects. Allocates, so it is for tests and slow UI paths. */
export interface SandboxSnapshot {
  time: number;
  prep: boolean;
  over: boolean;
  hidersSeen: number;
  hiders: AgentSnapshot[];
  seekers: AgentSnapshot[];
  boxes: SandboxBoxSnapshot[];
}

export function readSandboxSnapshot(buf: Float32Array): SandboxSnapshot {
  const { hiders, seekers, boxes } = sandboxCounts(buf);
  const agent = (slot: number): AgentSnapshot => {
    const o = sandboxAgentAt(slot);
    return { x: buf[o + AGENT_X], z: buf[o + AGENT_Z], yaw: buf[o + AGENT_YAW], flags: buf[o + AGENT_FLAGS], elevation: buf[o + AGENT_ELEVATION] };
  };
  const n = hiders + seekers;
  return {
    time: buf[0],
    prep: buf[1] === 1,
    over: buf[3] === 1,
    hidersSeen: buf[7],
    hiders: Array.from({ length: hiders }, (_, i) => agent(i)),
    seekers: Array.from({ length: seekers }, (_, i) => agent(hiders + i)),
    boxes: Array.from({ length: boxes }, (_, b) => {
      const o = sandboxBoxAt(n, b);
      const bits = buf[o + SANDBOX_BOX_BITS];
      return { x: buf[o + BOX_X], z: buf[o + BOX_Z], yaw: buf[o + BOX_YAW], kind: sandboxBoxKind(bits), locked: (bits & BOX_LOCKED) !== 0, lock: sandboxBoxLock(bits) };
    }),
  };
}

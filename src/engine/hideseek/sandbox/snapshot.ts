import { FLAG_FROZEN, FLAG_HOLDING, FLAG_SEEING, FLAG_SEEN, type AgentSnapshot } from '../snapshot';
import type { SandboxState } from './state';

/**
 * The Sandbox stream. Unlike the fixed 28 float arena snapshot, its size
 * depends on how many players and boxes the user picked, so a header says
 * how many of each follow:
 *
 *   header (8): time s, phase (1 prep, 0 seek), any hider seen (0 or 1),
 *               over (0 or 1), hiders, seekers, boxes, hiders seen
 *   per agent (4): x, z, yaw, flags (FLAG_HOLDING and friends), hiders first
 *   per box (4): x, z, yaw, bits (BOX_LOCKED, BOX_PLANK)
 *
 * The first three header fields match the arena snapshot, so HUD code that
 * reads time, phase and "seen" works on either stream.
 */
export const SANDBOX_HEADER = 8;
export const SANDBOX_ENTRY = 4;
export const BOX_LOCKED = 1;
export const BOX_PLANK = 2;

/** Floats in one Sandbox frame. */
export function sandboxSnapshotLength(agents: number, boxes: number): number {
  return SANDBOX_HEADER + SANDBOX_ENTRY * (agents + boxes);
}

/** Offset of agent `slot` in a frame. */
export function sandboxAgentAt(slot: number): number {
  return SANDBOX_HEADER + slot * SANDBOX_ENTRY;
}

/** Offset of box `index` in a frame whose header says `agents` players. */
export function sandboxBoxAt(agents: number, index: number): number {
  return SANDBOX_HEADER + (agents + index) * SANDBOX_ENTRY;
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
    out[o] = a.x;
    out[o + 1] = a.z;
    out[o + 2] = a.yaw;
    out[o + 3] = (a.holding ? FLAG_HOLDING : 0) | (a.seesOpponent ? FLAG_SEEING : 0) | (seenFlag ? FLAG_SEEN : 0) | (a.frozen ? FLAG_FROZEN : 0);
  }
  for (let b = 0; b < s.boxes.length; b++) {
    const box = s.boxes[b];
    const o = sandboxBoxAt(n, b);
    out[o] = box.x;
    out[o + 1] = box.z;
    out[o + 2] = box.yaw;
    out[o + 3] = (box.lockedBy >= 0 ? BOX_LOCKED : 0) | (box.kind === 'plank' ? BOX_PLANK : 0);
  }
}

/** One Sandbox frame decoded into objects. Allocates, so it is for tests and slow UI paths. */
export interface SandboxSnapshot {
  time: number;
  prep: boolean;
  over: boolean;
  hidersSeen: number;
  hiders: AgentSnapshot[];
  seekers: AgentSnapshot[];
  boxes: Array<{ x: number; z: number; yaw: number; locked: boolean; plank: boolean }>;
}

export function readSandboxSnapshot(buf: Float32Array): SandboxSnapshot {
  const { hiders, seekers, boxes } = sandboxCounts(buf);
  const agent = (slot: number): AgentSnapshot => {
    const o = sandboxAgentAt(slot);
    return { x: buf[o], z: buf[o + 1], yaw: buf[o + 2], flags: buf[o + 3] };
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
      return { x: buf[o], z: buf[o + 1], yaw: buf[o + 2], locked: (buf[o + 3] & BOX_LOCKED) !== 0, plank: (buf[o + 3] & BOX_PLANK) !== 0 };
    }),
  };
}

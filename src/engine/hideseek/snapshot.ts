import type { SnapshotLayout } from '../env/types';
import type { MatchState } from './match/state';
import { BOX_COUNT } from './physics';

/**
 * Agent flag bits, stored as a float in the snapshot (small integers are
 * exact in float32). SEEING and SEEN are per agent: SEEN on the hider means
 * the seeker sees it, SEEN on the seeker means the hider sees it.
 */
export const FLAG_HOLDING = 1;
export const FLAG_SEEING = 2;
export const FLAG_SEEN = 4;
/** Cannot act: a seeker during prep, or an agent its controller stopped. */
export const FLAG_FROZEN = 8;
/** On a ramp slope (see HideSeekAgent.climbing). */
export const FLAG_CLIMBING = 16;
/** In the air after running off a ramp lip. */
export const FLAG_AIRBORNE = 32;

/** Header fields: time s, phase (1 prep, 0 seek), hider seen (0 or 1), then a spare. */
export const SNAPSHOT_TIME = 0;
export const SNAPSHOT_PHASE = 1;
export const SNAPSHOT_SEEN = 2;
export const SNAPSHOT_HEADER = 4;

/** Each agent: x, z, yaw, flags, then elevation in meters. Hider first. */
export const AGENT_X = 0;
export const AGENT_Z = 1;
export const AGENT_YAW = 2;
export const AGENT_FLAGS = 3;
export const AGENT_ELEVATION = 4;
export const SNAPSHOT_AGENT_ENTRY = 5;
export const SNAPSHOT_AGENTS_AT = SNAPSHOT_HEADER;

/** Each box: x, z, yaw, then its lock (LOCK_FREE and friends). Box kinds follow BOX_KINDS by index. */
export const BOX_X = 0;
export const BOX_Z = 1;
export const BOX_YAW = 2;
export const BOX_LOCK = 3;
export const SNAPSHOT_BOX_ENTRY = 4;
export const SNAPSHOT_BOXES_AT = SNAPSHOT_AGENTS_AT + 2 * SNAPSHOT_AGENT_ENTRY;

/** Box lock values: free, or locked by a team, which owns the lock. */
export const LOCK_FREE = 0;
export const LOCK_HIDERS = 1;
export const LOCK_SEEKERS = 2;

/** The lock value of a box from its owner team index (see BoxState.lockedBy), -1 when free. */
export function lockCode(lockedBy: number): number {
  return lockedBy < 0 ? LOCK_FREE : lockedBy === 0 ? LOCK_HIDERS : LOCK_SEEKERS;
}

const agentFields = (name: string) => [`${name}.x`, `${name}.z`, `${name}.yaw`, `${name}.flags`, `${name}.elevation`];
const boxFields = (i: number) => [`box${i}.x`, `box${i}.z`, `box${i}.yaw`, `box${i}.lock`];

/**
 * One arena: the 4 float header, hider and seeker at 5 floats each, then
 * 4 floats per box in BOX_KINDS order. Positions in meters, yaw as in
 * frame.ts. Readers go through the offset constants, never raw numbers.
 */
export const HIDESEEK_SNAPSHOT: SnapshotLayout = {
  stride: SNAPSHOT_BOXES_AT + BOX_COUNT * SNAPSHOT_BOX_ENTRY,
  fields: ['time', 'phase', 'seen', 'spare', ...agentFields('hider'), ...agentFields('seeker'), ...Array.from({ length: BOX_COUNT }, (_, i) => boxFields(i)).flat()],
};

/** Flags an agent shows: holding, sight both ways, frozen, climbing and airborne. */
export function agentFlags(s: MatchState, i: number): number {
  const a = s.agents[i];
  return (
    (a.holding ? FLAG_HOLDING : 0) |
    (a.seesOpponent ? FLAG_SEEING : 0) |
    (s.agents[1 - i].seesOpponent ? FLAG_SEEN : 0) |
    (a.frozen ? FLAG_FROZEN : 0) |
    (a.climbing ? FLAG_CLIMBING : 0) |
    (a.airborne ? FLAG_AIRBORNE : 0)
  );
}

/** Offset of agent `i` (0 hider, 1 seeker) in an arena written at `offset`. */
export const snapshotAgentAt = (i: number, offset = 0): number => offset + SNAPSHOT_AGENTS_AT + i * SNAPSHOT_AGENT_ENTRY;

/** Offset of box `i` in an arena written at `offset`. */
export const snapshotBoxAt = (i: number, offset = 0): number => offset + SNAPSHOT_BOXES_AT + i * SNAPSHOT_BOX_ENTRY;

/** Writes one arena into a caller-owned buffer at `offset`. Allocates nothing. */
export function writeArenaSnapshot(s: MatchState, out: Float32Array, offset = 0): void {
  out[offset + SNAPSHOT_TIME] = s.tick * s.physics.dt;
  out[offset + SNAPSHOT_PHASE] = s.tick <= s.prepTicks ? 1 : 0;
  out[offset + SNAPSHOT_SEEN] = s.agents[0].seen ? 1 : 0;
  out[offset + 3] = 0;
  for (let i = 0; i < 2; i++) {
    const a = s.agents[i];
    const o = snapshotAgentAt(i, offset);
    out[o + AGENT_X] = a.x;
    out[o + AGENT_Z] = a.z;
    out[o + AGENT_YAW] = a.yaw;
    out[o + AGENT_FLAGS] = agentFlags(s, i);
    out[o + AGENT_ELEVATION] = a.elevation;
  }
  for (let i = 0; i < BOX_COUNT; i++) {
    const b = s.boxes[i];
    const o = snapshotBoxAt(i, offset);
    out[o + BOX_X] = b.x;
    out[o + BOX_Z] = b.z;
    out[o + BOX_YAW] = b.yaw;
    out[o + BOX_LOCK] = lockCode(b.lockedBy);
  }
}

export interface AgentSnapshot {
  x: number;
  z: number;
  yaw: number;
  flags: number;
  elevation: number;
}

export interface BoxSnapshot {
  x: number;
  z: number;
  yaw: number;
  /** LOCK_FREE, LOCK_HIDERS or LOCK_SEEKERS. */
  lock: number;
}

/** One arena decoded into objects. Allocates, so it is for tests, tools and slow UI paths. */
export interface ArenaSnapshot {
  time: number;
  prep: boolean;
  seen: boolean;
  agents: [AgentSnapshot, AgentSnapshot];
  boxes: BoxSnapshot[];
}

export function readArenaSnapshot(buf: Float32Array, offset = 0): ArenaSnapshot {
  const agent = (i: number): AgentSnapshot => {
    const o = snapshotAgentAt(i, offset);
    return { x: buf[o + AGENT_X], z: buf[o + AGENT_Z], yaw: buf[o + AGENT_YAW], flags: buf[o + AGENT_FLAGS], elevation: buf[o + AGENT_ELEVATION] };
  };
  const boxes: BoxSnapshot[] = [];
  for (let i = 0; i < BOX_COUNT; i++) {
    const o = snapshotBoxAt(i, offset);
    boxes.push({ x: buf[o + BOX_X], z: buf[o + BOX_Z], yaw: buf[o + BOX_YAW], lock: buf[o + BOX_LOCK] });
  }
  return { time: buf[offset + SNAPSHOT_TIME], prep: buf[offset + SNAPSHOT_PHASE] === 1, seen: buf[offset + SNAPSHOT_SEEN] === 1, agents: [agent(0), agent(1)], boxes };
}

export * from './snapshotRays';

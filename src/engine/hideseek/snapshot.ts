import type { SnapshotLayout } from '../env/types';
import { offsetX, offsetZ } from './frame';
import type { MatchState } from './match/state';
import { BOX_COUNT } from './physics';
import type { SensorRays } from './sensing/rays';

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

/** Where each part of an arena snapshot starts. Agents are hider then seeker; boxes 0 and 1 are cubes. */
export const SNAPSHOT_AGENTS_AT = 4;
export const SNAPSHOT_BOXES_AT = 12;
export const SNAPSHOT_ENTRY = 4;

const agentFields = (name: string) => [`${name}.x`, `${name}.z`, `${name}.yaw`, `${name}.flags`];
const boxFields = (i: number) => [`box${i}.x`, `box${i}.z`, `box${i}.yaw`, `box${i}.locked`];

/**
 * 28 floats per arena: [time s, phase (1 prep, 0 seek), hider seen (0 or 1),
 * spare], then hider and seeker as (x, z, yaw, flags), then four boxes as
 * (x, z, yaw, locked). Positions in meters, yaw as in frame.ts.
 */
export const HIDESEEK_SNAPSHOT: SnapshotLayout = {
  stride: 28,
  fields: ['time', 'phase', 'seen', 'spare', ...agentFields('hider'), ...agentFields('seeker'), ...[0, 1, 2, 3].flatMap(boxFields)],
};

export function agentFlags(s: MatchState, i: number): number {
  const a = s.agents[i];
  return (
    (a.holding ? FLAG_HOLDING : 0) |
    (a.seesOpponent ? FLAG_SEEING : 0) |
    (s.agents[1 - i].seesOpponent ? FLAG_SEEN : 0) |
    (a.frozen ? FLAG_FROZEN : 0)
  );
}

/** Writes one arena into a caller-owned buffer at `offset`. Allocates nothing. */
export function writeArenaSnapshot(s: MatchState, out: Float32Array, offset = 0): void {
  out[offset] = s.tick * s.physics.dt;
  out[offset + 1] = s.tick <= s.prepTicks ? 1 : 0;
  out[offset + 2] = s.agents[0].seen ? 1 : 0;
  out[offset + 3] = 0;
  for (let i = 0; i < 2; i++) {
    const a = s.agents[i];
    const o = offset + SNAPSHOT_AGENTS_AT + i * SNAPSHOT_ENTRY;
    out[o] = a.x;
    out[o + 1] = a.z;
    out[o + 2] = a.yaw;
    out[o + 3] = agentFlags(s, i);
  }
  for (let i = 0; i < BOX_COUNT; i++) {
    const b = s.boxes[i];
    const o = offset + SNAPSHOT_BOXES_AT + i * SNAPSHOT_ENTRY;
    out[o] = b.x;
    out[o + 1] = b.z;
    out[o + 2] = b.yaw;
    out[o + 3] = b.lockedBy >= 0 ? 1 : 0;
  }
}

export interface AgentSnapshot {
  x: number;
  z: number;
  yaw: number;
  flags: number;
}

export interface BoxSnapshot {
  x: number;
  z: number;
  yaw: number;
  locked: boolean;
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
    const o = offset + SNAPSHOT_AGENTS_AT + i * SNAPSHOT_ENTRY;
    return { x: buf[o], z: buf[o + 1], yaw: buf[o + 2], flags: buf[o + 3] };
  };
  const boxes: BoxSnapshot[] = [];
  for (let i = 0; i < BOX_COUNT; i++) {
    const o = offset + SNAPSHOT_BOXES_AT + i * SNAPSHOT_ENTRY;
    boxes.push({ x: buf[o], z: buf[o + 1], yaw: buf[o + 2], locked: buf[o + 3] === 1 });
  }
  return { time: buf[offset], prep: buf[offset + 1] === 1, seen: buf[offset + 2] === 1, agents: [agent(0), agent(1)], boxes };
}

/** Rays per agent in the optional rays stream. */
export const SNAPSHOT_RAYS = 16;

/**
 * The optional rays stream: 16 ray hit points (x, z) per agent, hider
 * first, 64 floats per arena. Brains with more rays are thinned evenly
 * (ray 0, straight ahead, is always kept). Brains with fewer fill the
 * spare slots with the agent's own position, which draws as nothing. A
 * blind seeker's rays reach their full range.
 */
export const HIDESEEK_RAY_SNAPSHOT: SnapshotLayout = {
  stride: 2 * SNAPSHOT_RAYS * 2,
  fields: ['hider', 'seeker'].flatMap((team) => Array.from({ length: SNAPSHOT_RAYS }, (_, k) => [`${team}.ray${k}.x`, `${team}.ray${k}.z`]).flat()),
};

export function writeRaySnapshot(s: MatchState, rays: SensorRays[], out: Float32Array, offset = 0): void {
  for (let i = 0; i < 2; i++) {
    const a = s.agents[i];
    const r = rays[i];
    const base = offset + i * SNAPSHOT_RAYS * 2;
    for (let k = 0; k < SNAPSHOT_RAYS; k++) {
      let x = a.x;
      let z = a.z;
      if (k < r.count || r.count > SNAPSHOT_RAYS) {
        const j = r.count > SNAPSHOT_RAYS ? Math.floor((k * r.count) / SNAPSHOT_RAYS) : k;
        const d = a.rays[j];
        const yaw = a.yaw + r.angles[j];
        x += offsetX(d, 0, yaw);
        z += offsetZ(d, 0, yaw);
      }
      out[base + 2 * k] = x;
      out[base + 2 * k + 1] = z;
    }
  }
}

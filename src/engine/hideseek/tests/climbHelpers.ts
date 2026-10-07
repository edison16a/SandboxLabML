import type { HideSeekMatch } from '../match/match';
import { hideSeekPhysics } from '../physics';
import { parkBoxes } from './helpers';

/** Box index of the ramp in every 1 v 1 room. */
export const RAMP = 4;

/** No prep phase, so a seeker can climb from the first tick. */
export const CLIMB_RULES = hideSeekPhysics({ prepShare: 0 });

/** Puts the ramp at (x, z) with its lip toward `yaw`, parks every other box, and locks the ramp when asked. */
export function placeRamp(m: HideSeekMatch, x: number, z: number, yaw: number, locked = false): void {
  parkBoxes(m, RAMP);
  const b = m.state.boxes[RAMP];
  b.x = x;
  b.z = z;
  b.yaw = yaw;
  m.state.arena.teleport(m.state.arena.boxes[RAMP], b);
  if (locked) m.setBoxLocked(RAMP, true);
}

/** Puts box `index` at (x, z) facing `yaw`, keeping whatever else is staged. */
export function placeBox(m: HideSeekMatch, index: number, x: number, z: number, yaw = 0): void {
  const b = m.state.boxes[index];
  b.x = x;
  b.z = z;
  b.yaw = yaw;
  m.state.arena.teleport(m.state.arena.boxes[index], b);
}

/** One tick of an agent's climb, as plain numbers, for checking a run after the fact. */
export interface ClimbFrame {
  tick: number;
  x: number;
  z: number;
  elevation: number;
  climbing: boolean;
  airborne: boolean;
  justVaulted: boolean;
}

/** Steps `ticks` times and records agent `i` after every step. */
export function record(m: HideSeekMatch, i: number, ticks: number): ClimbFrame[] {
  const out: ClimbFrame[] = [];
  for (let t = 0; t < ticks && !m.done; t++) {
    m.step();
    const a = m.state.agents[i];
    out.push({ tick: m.tick, x: a.x, z: a.z, elevation: a.elevation, climbing: a.climbing, airborne: a.airborne, justVaulted: a.justVaulted });
  }
  return out;
}

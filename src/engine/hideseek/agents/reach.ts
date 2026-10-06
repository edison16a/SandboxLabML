import { bearing } from '../frame';
import type { BoxState, MatchState } from '../match/state';

/** Whether agent slot `agent` may act on a box. Module-level functions, so a search allocates nothing. */
export type BoxFilter = (box: BoxState, agent: number) => boolean;

/** Free boxes only: not locked by anyone and not held by the other agent. */
export const canGrab: BoxFilter = (b) => b.lockedBy < 0 && b.heldBy < 0;

/** Boxes nobody holds that are free or already locked by this agent's own team. */
export const canToggleLock: BoxFilter = (b, agent) => b.heldBy < 0 && (b.lockedBy < 0 || b.lockedBy === agent);

/**
 * The nearest box whose center is within `range` of the agent and inside
 * the cone in front of it (`cone` is the full width), among boxes that pass
 * `filter`. Returns its index, or -1. Ties go to the lower index so the
 * choice never depends on float noise in the sort.
 */
export function findBoxInFront(s: MatchState, agent: number, range: number, cone: number, filter: BoxFilter): number {
  const a = s.agents[agent];
  const half = cone / 2;
  let best = -1;
  let bestDistance = range;
  for (let i = 0; i < s.boxes.length; i++) {
    const b = s.boxes[i];
    if (!filter(b, agent)) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d > bestDistance || (d === bestDistance && best >= 0)) continue;
    if (Math.abs(bearing(dx, dz, a.yaw)) > half) continue;
    best = i;
    bestDistance = d;
  }
  return best;
}

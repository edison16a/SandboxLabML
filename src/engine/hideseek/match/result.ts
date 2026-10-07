import type { HideSeekLayoutId } from '../layouts/types';
import type { MatchState } from './state';
import type { MatchResult } from './types';

/** A box this far from its start counts as moved, m. Above spawn jitter and the odd nudge. */
export const BOX_MOVED_DISTANCE = 0.5;

/** Turns the state of a finished (or stopped early) match into its result. */
export function buildResult(s: MatchState, layout: HideSeekLayoutId, seed: number): MatchResult {
  const [hider, seeker] = s.agents;
  const t = s.tally;
  let moved = 0;
  let travel = 0;
  let locked = 0;
  for (const b of s.boxes) {
    if (Math.hypot(b.x - b.spawnX, b.z - b.spawnZ) > BOX_MOVED_DISTANCE) moved++;
    travel += b.travel;
    if (b.lockedBy >= 0) locked++;
  }
  const seek = t.seekTicks;
  return {
    layout,
    seed,
    ticks: s.tick,
    hiderReward: hider.fitness,
    seekerReward: seeker.fitness,
    hiddenShare: seek > 0 ? t.hiddenTicks / seek : 0,
    seenShare: seek > 0 ? t.seenTicks / seek : 0,
    exposedShare: seek > 0 ? t.exposedTicks / seek : 0,
    firstSeenAt: t.firstSeenTick < 0 ? -1 : (t.firstSeenTick - s.prepTicks) * s.physics.dt,
    locksPlaced: t.locks,
    hiderLocks: hider.locks,
    seekerLocks: seeker.locks,
    unlocks: t.unlocks,
    lockedAtEnd: locked,
    hiderGrabs: hider.grabs,
    seekerGrabs: seeker.grabs,
    boxesMoved: moved,
    boxTravel: travel,
    hiderStop: hider.stopReason,
    seekerStop: seeker.stopReason,
  };
}

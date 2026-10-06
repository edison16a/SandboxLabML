import type { Rng } from '../../core/rng';
import { HIT_AGENT, HIT_BOX, NEVER_SEEN_AGE } from '../agents/agent';
import { bearing, localAhead, localLeft } from '../frame';
import type { HideSeekInputConfig } from '../inputConfig';
import type { MatchState } from '../match/state';
import { BOX_COUNT, type HideSeekPhysics } from '../physics';

/**
 * Writes one agent's built-in inputs, normalized, in the exact order of
 * `hideSeekInputSchema`. Scratch arrays live on the observer, so a tick
 * allocates nothing.
 */
export class HideSeekObserver {
  readonly cfg: HideSeekInputConfig;
  readonly physics: HideSeekPhysics;
  private readonly distances = new Float64Array(BOX_COUNT);
  private readonly order = new Int32Array(BOX_COUNT);

  constructor(cfg: HideSeekInputConfig, physics: HideSeekPhysics) {
    this.cfg = cfg;
    this.physics = physics;
  }

  /**
   * Fills `out` from the start and returns how many values were written.
   * Rays must have been cast for this tick. Noise, when enabled, comes from
   * the agent's own seeded Rng so a replay sees the same noise as training.
   */
  write(s: MatchState, i: number, out: Float64Array, noise: Rng | null): number {
    const cfg = this.cfg;
    const p = this.physics;
    const a = s.agents[i];
    let n = 0;
    const count = cfg.rays.count;
    const range = cfg.rays.range;
    for (let k = 0; k < count; k++) out[n++] = a.rays[k] / range;
    if (cfg.rays.hitTypes) {
      for (let k = 0; k < count; k++) out[n++] = a.rayHits[k] === HIT_BOX ? 1 : 0;
      for (let k = 0; k < count; k++) out[n++] = a.rayHits[k] === HIT_AGENT ? 1 : 0;
    }
    const top = p.agent.maxSpeed;
    if (cfg.velocity) {
      out[n++] = a.speed / top;
      out[n++] = a.sideSpeed / top;
    } else if (cfg.speed) {
      out[n++] = a.speed / top;
    }
    if (cfg.holding) out[n++] = a.holding ? 1 : 0;
    if (cfg.phase) out[n++] = a.prep ? 1 : 0;
    if (cfg.time) out[n++] = a.timeLeft / p.matchSeconds;
    if (cfg.opponentVisible) out[n++] = a.seesOpponent ? 1 : 0;
    if (cfg.opponentLastSeen) {
      const seenOnce = a.lastSeenAge < NEVER_SEEN_AGE;
      out[n++] = seenOnce ? bearing(a.lastSeenX - a.x, a.lastSeenZ - a.z, a.yaw) / Math.PI : 0;
    }
    if (cfg.nearestBoxes > 0) n = this.writeBoxes(s, i, out, n);
    if (noise && cfg.noise > 0) for (let k = 0; k < n; k++) out[k] += noise.gaussian() * cfg.noise;
    return n;
  }

  /**
   * Nearest boxes first, ties by index. Each gives x ahead and z to the
   * right in the agent frame, the distance, all over the room size, and a
   * locked flag. Slots past the number of boxes read as far away.
   */
  private writeBoxes(s: MatchState, i: number, out: Float64Array, n: number): number {
    const a = s.agents[i];
    const size = this.physics.arena.size;
    const d = this.distances;
    const order = this.order;
    for (let b = 0; b < BOX_COUNT; b++) {
      d[b] = Math.hypot(s.boxes[b].x - a.x, s.boxes[b].z - a.z);
      // Insertion sort: stable and allocation free for four items.
      let j = b;
      while (j > 0 && d[order[j - 1]] > d[b]) {
        order[j] = order[j - 1];
        j--;
      }
      order[j] = b;
    }
    for (let k = 0; k < this.cfg.nearestBoxes; k++) {
      if (k >= BOX_COUNT) {
        out[n++] = 0;
        out[n++] = 0;
        out[n++] = 1;
        out[n++] = 0;
        continue;
      }
      const b = s.boxes[order[k]];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      out[n++] = localAhead(dx, dz, a.yaw) / size;
      out[n++] = -localLeft(dx, dz, a.yaw) / size;
      out[n++] = d[order[k]] / size;
      out[n++] = b.lockedBy >= 0 ? 1 : 0;
    }
    return n;
  }
}

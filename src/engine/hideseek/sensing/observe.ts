import type { Rng } from '../../core/rng';
import { HIT_AGENT, HIT_BOX, HIT_RAMP, NEVER_SEEN_AGE } from '../agents/agent';
import { bearing, localAhead, localLeft } from '../frame';
import type { HideSeekInputConfig } from '../inputConfig';
import type { PlayState } from '../match/state';
import type { HideSeekPhysics } from '../physics';
import { writeRamp } from './observeRamp';

/**
 * Writes one agent's built-in inputs, normalized, in the exact order of
 * `hideSeekInputSchema`. Scratch arrays live on the observer, so a tick
 * allocates nothing.
 */
export class HideSeekObserver {
  readonly cfg: HideSeekInputConfig;
  readonly physics: HideSeekPhysics;
  /** Scratch for sorting boxes by distance. Grows to the number of boxes, which the Sandbox lets vary. */
  private distances = new Float64Array(4);
  private order = new Int32Array(4);

  constructor(cfg: HideSeekInputConfig, physics: HideSeekPhysics) {
    this.cfg = cfg;
    this.physics = physics;
  }

  /**
   * Fills `out` from the start and returns how many values were written.
   * Rays must have been cast for this tick. Noise, when enabled, comes from
   * the agent's own seeded Rng so a replay sees the same noise as training.
   */
  write(s: PlayState, i: number, out: Float64Array, noise: Rng | null): number {
    const cfg = this.cfg;
    const p = this.physics;
    const a = s.agents[i];
    let n = 0;
    const count = cfg.rays.count;
    const range = cfg.rays.range;
    for (let k = 0; k < count; k++) out[n++] = a.rays[k] / range;
    if (cfg.rays.hitTypes) {
      // Crates and ramps alike read as a box, so the per ray inputs keep their shape.
      for (let k = 0; k < count; k++) out[n++] = a.rayHits[k] === HIT_BOX || a.rayHits[k] === HIT_RAMP ? 1 : 0;
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
    if (cfg.ramp) n = writeRamp(s, i, out, n);
    if (noise && cfg.noise > 0) for (let k = 0; k < n; k++) out[k] += noise.gaussian() * cfg.noise;
    return n;
  }

  /**
   * Nearest cubes and planks first, ties by index. Each gives x ahead and
   * z to the right in the agent frame, the distance, all over the room
   * size, and a locked flag. Slots past the number of boxes read as far
   * away. Ramps have their own group.
   */
  private writeBoxes(s: PlayState, i: number, out: Float64Array, n: number): number {
    const a = s.agents[i];
    const size = this.physics.arena.size;
    const count = s.boxes.length;
    if (this.distances.length < count) {
      this.distances = new Float64Array(count);
      this.order = new Int32Array(count);
    }
    const d = this.distances;
    const order = this.order;
    let crates = 0;
    for (let b = 0; b < count; b++) {
      // Ramps sort after every crate, so they never take a box slot from one.
      d[b] = s.boxes[b].kind === 'ramp' ? Infinity : Math.hypot(s.boxes[b].x - a.x, s.boxes[b].z - a.z);
      if (d[b] !== Infinity) crates++;
      // Insertion sort: stable and allocation free, and the lists are short.
      let j = b;
      while (j > 0 && d[order[j - 1]] > d[b]) {
        order[j] = order[j - 1];
        j--;
      }
      order[j] = b;
    }
    for (let k = 0; k < this.cfg.nearestBoxes; k++) {
      if (k >= crates) {
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

import { STRIDE } from '../frame/snapshotRead';
import { MAX_ARENAS } from './scratch';

/**
 * Running hidden time against seen time for each arena of the feed, from
 * the snapshots alone. A frame counts once: each arena remembers the match
 * time it last counted, and a time that goes backwards means a new match.
 */
export class ArenaBalance {
  readonly hidden = new Float32Array(MAX_ARENAS);
  readonly seen = new Float32Array(MAX_ARENAS);
  private readonly last = new Float32Array(MAX_ARENAS).fill(-1);
  private epoch = Number.NaN;

  update(curr: Float32Array, first: number, count: number, epoch: number): void {
    if (epoch !== this.epoch) {
      this.epoch = epoch;
      this.hidden.fill(0);
      this.seen.fill(0);
      this.last.fill(-1);
    }
    for (let k = 0; k < count && k < MAX_ARENAS; k++) {
      const o = (first + k) * STRIDE;
      const time = curr[o];
      if (time < this.last[k]) {
        this.hidden[k] = this.seen[k] = 0;
      } else if (time > this.last[k] && this.last[k] >= 0 && curr[o + 1] === 0) {
        const dt = time - this.last[k];
        if (curr[o + 2] === 1) this.seen[k] += dt;
        else this.hidden[k] += dt;
      }
      this.last[k] = time;
    }
  }

  /** -1 when the seeker has had the hider in sight all along, +1 when it never has, 0 when even or not started. */
  balance(k: number): number {
    const total = this.hidden[k] + this.seen[k];
    return total > 0 ? (this.hidden[k] - this.seen[k]) / total : 0;
  }
}

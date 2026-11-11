import { NAV_FINISHED, NAV_RUNNING } from '@/engine/navigation/agent';
import { NAVIGATION_SNAPSHOT, SNAP_PROGRESS, SNAP_STATUS, SNAP_STOP_TIME } from '@/engine/navigation/snapshot';

const STRIDE = NAVIGATION_SNAPSHOT.stride;

/** Share of the course another runner must gain on the followed one before the view moves to it, so it never flicks along a tight pack. */
export const SWITCH_MARGIN = 0.05;
/** Seconds the view holds a new leader before it may switch again. */
export const MIN_HOLD = 1.2;
/** Seconds of simulation the view stays on a leader after it dies, to show the fall, and after it finishes, to show the moment. */
export const DEATH_BEAT = 0.85;
export const FINISH_BEAT = 0.95;

/** The best runner still going: the furthest along, or -1. */
function bestRunning(buf: Float32Array, count: number): number {
  let best = -1;
  let bestP = -Infinity;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    if (buf[o + SNAP_STATUS] === NAV_RUNNING && buf[o + SNAP_PROGRESS] > bestP) {
      bestP = buf[o + SNAP_PROGRESS];
      best = i;
    }
  }
  return best;
}

/** With nobody running: the first finisher, else whoever got furthest. */
function bestOverall(buf: Float32Array, count: number): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const score = buf[o + SNAP_STATUS] === NAV_FINISHED ? 2 - buf[o + SNAP_STOP_TIME] * 1e-3 : buf[o + SNAP_PROGRESS];
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * Picks the agent the view follows: the best performer, held steady. It
 * keeps its leader while that one runs and nobody pulls clearly ahead,
 * stays a beat after its leader dies or finishes so the moment is seen,
 * then moves on to the best runner left. The camera glides between them
 * on its own spring, so a switch never jumps the view.
 */
export class LeaderPicker {
  current = -1;
  private heldSince = 0;
  private epoch = Number.NaN;

  /** The leader for snapshot `buf` of `count` agents at episode time `time` (s). */
  pick(buf: Float32Array | null, count: number, time: number, epoch: number): number {
    if (!buf || count === 0) return (this.current = -1);
    if (epoch !== this.epoch || this.current >= count || time < this.heldSince) {
      this.epoch = epoch;
      this.current = -1;
    }
    const c = this.current;
    if (c < 0) return this.take(bestRunning(buf, count) >= 0 ? bestRunning(buf, count) : bestOverall(buf, count), time);
    const o = c * STRIDE;
    const status = buf[o + SNAP_STATUS];
    if (status === NAV_RUNNING) {
      if (time - this.heldSince < MIN_HOLD) return c;
      const best = bestRunning(buf, count);
      return best >= 0 && best !== c && buf[best * STRIDE + SNAP_PROGRESS] > buf[o + SNAP_PROGRESS] + SWITCH_MARGIN ? this.take(best, time) : c;
    }
    const beat = status === NAV_FINISHED ? FINISH_BEAT : DEATH_BEAT;
    if (time - buf[o + SNAP_STOP_TIME] < beat) return c;
    const next = bestRunning(buf, count);
    if (next >= 0) return this.take(next, time);
    // Everyone is done: settle on the winner, unless the view already shows a finisher.
    return status === NAV_FINISHED ? c : this.take(bestOverall(buf, count), time);
  }

  private take(i: number, time: number): number {
    if (i !== this.current) this.heldSince = time;
    return (this.current = i);
  }
}

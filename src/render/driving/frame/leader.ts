import { STATUS_ARRIVED, STATUS_DRIVING } from '@/engine/driving/agent/learner';
import { DRIVING_SNAPSHOT, SNAP } from '@/engine/driving/snapshot';

const STRIDE = DRIVING_SNAPSHOT.stride;
/**
 * Meters of route another SUV must gain on the followed leader before the
 * camera moves to it. Late in training the whole population drives one
 * line, and without this margin the lead would flick between neighbors.
 */
export const SWITCH_MARGIN = 8;

/** The furthest along of the SUVs still driving, or -1 when none is. */
function furthestDriving(buf: Float32Array, count: number): number {
  let best = -1;
  let bestP = -Infinity;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    if (buf[o + SNAP.status] === STATUS_DRIVING && buf[o + SNAP.progress] > bestP) {
      bestP = buf[o + SNAP.progress];
      best = i;
    }
  }
  return best;
}

/** Once nobody drives: the first one that arrived, else the furthest along. */
function bestFinished(buf: Float32Array, count: number): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const score = buf[o + SNAP.progress] + (buf[o + SNAP.status] === STATUS_ARRIVED ? 1e6 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * The SUV doing best right now: the furthest along its route of those still
 * driving, or the best finisher once all have stopped. `current` keeps the
 * lead while it is still driving and nobody is SWITCH_MARGIN meters ahead,
 * so the camera stays on one car instead of hopping along a tight pack. An
 * SUV that arrived keeps the camera until the episode ends.
 */
export function pickLeader(buf: Float32Array, count: number, current: number): number {
  if (current >= 0 && current < count && buf[current * STRIDE + SNAP.status] === STATUS_ARRIVED) return current;
  const best = furthestDriving(buf, count);
  if (best < 0) return bestFinished(buf, count);
  if (current < 0 || current >= count || current === best || buf[current * STRIDE + SNAP.status] !== STATUS_DRIVING) return best;
  return buf[best * STRIDE + SNAP.progress] > buf[current * STRIDE + SNAP.progress] + SWITCH_MARGIN ? best : current;
}

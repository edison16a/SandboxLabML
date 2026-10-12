import { RACING_SNAPSHOT } from '@/engine/racing/env';

const STRIDE = RACING_SNAPSHOT.stride;
/**
 * Meters of road another car must gain on the followed leader before the
 * camera moves to it. Cars late in training run nose to tail, and without
 * this margin the lead would flick between two of them every few frames.
 */
export const SWITCH_MARGIN = 6;

/** Index of the furthest car along the road among those still driving, or -1 when none is. */
function furthestRunning(buf: Float32Array, count: number): number {
  let best = -1;
  let bestP = -Infinity;
  for (let i = 0; i < count; i++) {
    const p = buf[i * STRIDE + 7];
    if (buf[i * STRIDE + 6] === 0 && p > bestP) {
      bestP = p;
      best = i;
    }
  }
  return best;
}

/** Index of the furthest car along the road, crashed or not. */
function furthestAny(buf: Float32Array, count: number): number {
  let best = -1;
  let bestP = -Infinity;
  for (let i = 0; i < count; i++) {
    if (buf[i * STRIDE + 7] > bestP) {
      bestP = buf[i * STRIDE + 7];
      best = i;
    }
  }
  return best;
}

/**
 * The car doing best right now: the furthest along the road of those still
 * driving, or of all of them once every car has stopped. `current` is the
 * leader picked last frame. It keeps the lead while it is still driving
 * and no car is SWITCH_MARGIN m ahead of it, so the chase camera stays on
 * one car instead of hopping along a tight pack.
 */
export function pickLeader(buf: Float32Array, count: number, current: number): number {
  const best = furthestRunning(buf, count);
  if (best < 0) return furthestAny(buf, count);
  if (current < 0 || current >= count || current === best || buf[current * STRIDE + 6] !== 0) return best;
  return buf[best * STRIDE + 7] > buf[current * STRIDE + 7] + SWITCH_MARGIN ? best : current;
}

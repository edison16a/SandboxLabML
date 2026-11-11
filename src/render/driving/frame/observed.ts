import { HIT_NONE } from '@/engine/driving/sensors/lidar';
import type { FocusSense } from './focusSense';

/** One observation of the inspected SUV as its brain received it, and the stream tick it came with. */
export interface Observation {
  index: number;
  tick: number;
  obs: Float32Array;
}

/**
 * The latest two observations the workers streamed for the inspected SUV,
 * so the overlay can draw what the brain really read (sensor noise and a
 * Sandbox lesion included) and blend it at display rate like the pose.
 */
export interface ObservedInputs {
  prev: Observation | null;
  curr: Observation | null;
}

/** A beam the brain read within this of its range, m, counts as clear. */
const HIT_SLACK = 0.5;

/**
 * Replaces the beam lengths the overlay worked out on the drawn world with
 * the ones the brain read, when the stream carries the followed SUV's
 * inputs for the frames on screen. The lidar inputs come first in every
 * Driving observation, as fractions of the range. What each beam hit
 * stays as sensed on screen, except that a beam the brain read as clear
 * draws as clear.
 */
export function applyObserved(sense: FocusSense, observed: ObservedInputs | null, focus: number, prevTick: number, currTick: number, alpha: number): void {
  const curr = observed?.curr;
  if (!curr || curr.index !== focus || curr.tick !== currTick || curr.obs.length < sense.beams) return;
  const prev = observed?.prev;
  const blend = prev && prev.index === focus && prev.tick === prevTick && prev.obs.length >= sense.beams;
  const range = sense.range;
  for (let i = 0; i < sense.beams; i++) {
    const read = blend ? prev.obs[i] + (curr.obs[i] - prev.obs[i]) * alpha : curr.obs[i];
    const d = Math.max(0, Math.min(1, read)) * range;
    sense.dist[i] = d;
    if (d >= range - HIT_SLACK) sense.kind[i] = HIT_NONE;
  }
}

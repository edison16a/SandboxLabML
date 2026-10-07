import { lerp, lerpAngle } from '@/engine/core/math';

/**
 * Reads one agent's pose from two snapshots and blends them. Renderers run
 * at 60 Hz while snapshots arrive at 30 Hz, so blending removes the stutter
 * at the cost of one tick of delay.
 */
export interface Pose {
  x: number;
  y: number;
  heading: number;
}

export function blendPose(prev: Float32Array | null, curr: Float32Array, o: number, alpha: number, out: Pose): Pose {
  if (!prev || prev.length <= o + 2) {
    out.x = curr[o];
    out.y = curr[o + 1];
    out.heading = curr[o + 2];
    return out;
  }
  out.x = lerp(prev[o], curr[o], alpha);
  out.y = lerp(prev[o + 1], curr[o + 1], alpha);
  out.heading = lerpAngle(prev[o + 2], curr[o + 2], alpha);
  return out;
}

/** Blends a scalar field at offset `o`. */
export function blendField(prev: Float32Array | null, curr: Float32Array, o: number, alpha: number): number {
  if (!prev || prev.length <= o) return curr[o];
  return lerp(prev[o], curr[o], alpha);
}

/**
 * Critically damped spring step, used by the chase camera and body roll.
 * It reaches the target as fast as possible without overshooting.
 */
export function springStep(value: number, velocity: number, target: number, omega: number, dt: number): [number, number] {
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = value - target;
  const temp = (velocity + omega * change) * dt;
  const nextVelocity = (velocity - omega * temp) * exp;
  const nextValue = target + (change + temp) * exp;
  return [nextValue, nextVelocity];
}

/** One axis of a critically damped spring, kept between frames. */
export interface Spring {
  value: number;
  velocity: number;
}

/**
 * springStep for a spring held in an object: it steps the spring in place
 * and returns the new value, so a camera that runs every frame allocates
 * nothing.
 */
export function stepSpring(s: Spring, target: number, omega: number, dt: number): number {
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = s.value - target;
  const temp = (s.velocity + omega * change) * dt;
  s.velocity = (s.velocity - omega * temp) * exp;
  s.value = target + (change + temp) * exp;
  return s.value;
}

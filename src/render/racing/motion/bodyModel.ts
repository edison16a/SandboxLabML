import { GRAVITY } from '@/engine/racing/car/params';
import { damped, stepDamped, type Damped } from './damped';
import type { TickMotion } from './tickMotion';

/**
 * Suspension tuning for a stiff mid engine car, per g of acceleration:
 * about 2.3 degrees of roll and 1.3 of pitch, a body that rings at 1.4 to
 * 2 Hz and settles within a bounce. Real road cars roll more; race cars
 * less. These read as weight without looking soft.
 */
const ROLL_PER_G = 0.04;
const PITCH_PER_G = 0.023;
/** How far the nose turns into a bend at the grip limit, rad per m/s^2 of cornering. */
const SLIP_PER_ACCEL = 0.0032;
/** Aerodynamic squat at top speed, m. */
const SQUAT = 0.014;

/** The sprung body's state: heave (m), pitch and roll (rad), and the body's slip angle (rad). */
export interface BodyMotion {
  heave: Damped;
  pitch: Damped;
  roll: Damped;
  slip: Damped;
}

export function bodyMotion(): BodyMotion {
  return { heave: damped(), pitch: damped(), roll: damped(), slip: damped() };
}

/** What the road does to the body this frame, from wheel contact: average lift (m), and side and front differences. */
export interface RoadInput {
  lift: number;
  /** Left wheels' lift minus right wheels', m. */
  side: number;
  /** Front wheels' lift minus rear wheels', m. */
  front: number;
}

export const FLAT_ROAD: RoadInput = { lift: 0, side: 0, front: 0 };

/**
 * Steps the body toward where the forces put it. Braking pitches the nose
 * down and acceleration squats it, cornering rolls it toward the outside of
 * the bend, and at the grip limit the tail steps out a few degrees. Kerbs
 * lift the side they touch. Everything goes through damped springs, so
 * the body lags, overshoots a touch and settles instead of snapping.
 */
export function stepBody(b: BodyMotion, m: TickMotion, speed: number, road: RoadInput, dt: number, track = 1.6, wheelbase = 2.7): void {
  const limit = Math.min(1, Math.max(0, (m.usage - 0.55) / 0.4));
  stepDamped(b.pitch, (m.accelLong / GRAVITY) * PITCH_PER_G + road.front / wheelbase, 1.6, 0.42, dt);
  // A left turn (positive lateral) throws weight right: positive roll about +x lowers the right side and lifts the left.
  stepDamped(b.roll, (m.accelLat / GRAVITY) * ROLL_PER_G + road.side / track, 1.4, 0.48, dt);
  stepDamped(b.heave, -SQUAT * Math.min(1, (speed / 35) ** 2) + road.lift * 0.7, 2.1, 0.36, dt);
  stepDamped(b.slip, m.accelLat * SLIP_PER_ACCEL * limit * limit, 1.1, 0.7, dt);
}

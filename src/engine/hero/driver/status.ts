import { STATUS_ARRIVED, type DrivingLearner } from '../../driving/agent/learner';
import { LIGHT_RED, LIGHT_YELLOW } from '../../driving/signals/plan';

/** What the hero SUV is doing, in a word the landing page turns into a short line. */
export type DriverStatus = 'drive' | 'red' | 'slowing' | 'person' | 'car' | 'left' | 'right' | 'arrived';

/** Standing still means slower than this, m/s. */
export const STILL = 0.8;
/** How near a red light, a person or a car has to be to explain a stop, m. The trip judge counts stops the same way. */
export const RED_NEAR = 20;
export const PERSON_NEAR = 16;
const CAR_NEAR = 12;
/** How near a red light has to be for braking toward it to count, m. */
const SLOWING_NEAR = 40;

/**
 * Reads what the SUV is doing right now from its own learner state: the
 * same perception its brain's inputs come from, so the words on the page
 * describe what the brain was reacting to.
 */
export function driverStatus(l: DrivingLearner): DriverStatus {
  if (l.status === STATUS_ARRIVED) return 'arrived';
  const s = l.sense;
  const redAhead = (s.light === LIGHT_RED || s.light === LIGHT_YELLOW) && s.lightDistance < RED_NEAR;
  if (l.car.speed < STILL) {
    if (s.ped >= 0 && s.pedDistance < PERSON_NEAR) return 'person';
    if (redAhead) return 'red';
    if (s.car >= 0 && s.gap < CAR_NEAR) return 'car';
  } else if ((s.light === LIGHT_RED || s.light === LIGHT_YELLOW) && s.lightDistance < SLOWING_NEAR && l.car.accelLong < -0.4) return 'slowing';
  if (l.inIntersection && l.turnDistance <= 0 && l.nextTurn !== 0) return l.nextTurn < 0 ? 'left' : 'right';
  return 'drive';
}

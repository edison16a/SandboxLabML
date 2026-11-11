import { DEFAULT_ROUTE, type RouteOptions } from './route/planner';

/**
 * Traffic profiles, from empty streets to rush hour. A run's curriculum
 * walks up these; a script's generation block can also pick one.
 */
export interface DrivingLevel {
  id: number;
  name: string;
  /** Signals cycle; when off every head flashes yellow and nobody has to stop. */
  signals: boolean;
  pedestrians: number;
  traffic: number;
  /** Chance per person per minute of crossing mid block, away from any crossing. */
  jaywalk: number;
  /** Chance that a person reaching a crossing on the flashing hand still goes. */
  lateCross: number;
  /** The trips driven at this level: short and simple while brains learn to steer. */
  route: RouteOptions;
  /** Seconds allowed for each stop line on the way, on top of the drive itself: more where queues form. */
  stopWait: number;
  /**
   * Only the car's center leaving the road ends the episode; a wheel over
   * the curb just costs a little. Brains that are learning to steer can
   * then clip a corner and still find out what a turn is. Once people walk
   * the sidewalks the curb is strict.
   */
  lenientCurb: boolean;
  /**
   * Arriving means the car's center is in the destination zone below this
   * speed, m/s. The first level only asks to roll in under 30 km/h; from the
   * second on, the car must stop there.
   */
  arriveSpeed: number;
}

/** Below this speed a car counts as stopped at its destination, m/s. */
const STOPPED = 1.5;
/** First trips: one turn at most, a couple of blocks long. */
const FIRST_TRIPS: RouteOptions = { minLength: 120, maxLength: 260, minTurns: 0, maxTurns: 1 };

export const DRIVING_LEVELS: readonly DrivingLevel[] = [
  { id: 1, name: 'Empty streets', signals: false, pedestrians: 0, traffic: 0, jaywalk: 0, lateCross: 0, route: FIRST_TRIPS, stopWait: 15, lenientCurb: true, arriveSpeed: 8 },
  { id: 2, name: 'Traffic lights', signals: true, pedestrians: 0, traffic: 0, jaywalk: 0, lateCross: 0, route: FIRST_TRIPS, stopWait: 15, lenientCurb: true, arriveSpeed: STOPPED },
  { id: 3, name: 'Pedestrians', signals: true, pedestrians: 60, traffic: 0, jaywalk: 0, lateCross: 0, route: DEFAULT_ROUTE, stopWait: 18, lenientCurb: false, arriveSpeed: STOPPED },
  { id: 4, name: 'Traffic', signals: true, pedestrians: 76, traffic: 28, jaywalk: 0, lateCross: 0.1, route: DEFAULT_ROUTE, stopWait: 26, lenientCurb: false, arriveSpeed: STOPPED },
  { id: 5, name: 'Rush hour', signals: true, pedestrians: 120, traffic: 44, jaywalk: 0.5, lateCross: 0.3, route: DEFAULT_ROUTE, stopWait: 30, lenientCurb: false, arriveSpeed: STOPPED },
];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = DRIVING_LEVELS.length;

export function drivingLevel(id: number): DrivingLevel {
  const k = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(id)));
  return DRIVING_LEVELS[k - 1];
}

/** Episode time limit for a trip, s: generous enough to wait at every light on the way. */
export function timeLimit(routeLength: number, stops: number, stopWait = 15): number {
  return Math.round(30 + routeLength / 5 + stops * stopWait);
}

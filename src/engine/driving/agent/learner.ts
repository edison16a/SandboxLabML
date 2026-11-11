import { createCar, type CarState } from '../car/dynamics';
import type { Route } from '../route/route';
import { perception, type Perception } from '../sensors/perception';
import { MAX_PEDS, MAX_TRAFFIC } from '../world/state';

export const STATUS_DRIVING = 0;
export const STATUS_CRASHED = 1;
export const STATUS_STOPPED = 2;
export const STATUS_ARRIVED = 3;

/** Why an episode ended for a learner, as a number for the snapshot. */
export const REASONS = ['', 'crash', 'pedestrian', 'offroad', 'arrived', 'time', 'stuck', 'lost'] as const;
export type StopReason = (typeof REASONS)[number] | string;

export function reasonCode(reason: string | null): number {
  if (!reason) return 0;
  const k = REASONS.indexOf(reason as (typeof REASONS)[number]);
  return k > 0 ? k : REASONS.length;
}

/**
 * One SUV in an episode: its physics, where it is on its route, what it
 * senses and what happened to it. Scripts compile to direct field reads on
 * this object, so keep names stable and plain.
 */
export interface DrivingLearner {
  index: number;
  /** Per learner seed (from run seed, generation and genome id) for sensor noise and script rand(). */
  seed: number;
  car: CarState;
  status: number;
  stopReason: string | null;
  fitness: number;
  time: number;

  /** Route arc length of the car's center, m, its best so far, and how much new ground this tick added. */
  progress: number;
  maxProgress: number;
  progressGain: number;
  /** Nearest route sample, the search hint for next tick. */
  routeIndex: number;
  /** Meters left to the destination's center (negative once past it). */
  remaining: number;
  /** Offset from the lane center (left positive), m, and heading error, rad. */
  lateral: number;
  headingError: number;
  /** Bearing from the car's heading to the lane center AIM_AHEAD meters on, rad, left positive: where to point the car. */
  aim: number;
  /** True while the car's center is inside the destination zone. */
  inDestination: boolean;
  curveNear: number;
  curveFar: number;
  /** True while crossing an intersection on a turn connector. */
  inIntersection: boolean;
  /** The next maneuver: -1 left, 0 straight (or arrive), 1 right. */
  nextTurn: number;
  /** Meters from the front bumper to where that maneuver starts (0 while in it). */
  turnDistance: number;
  speedLimit: number;
  sense: Perception;

  lidar: Float64Array;
  lidarKind: Uint8Array;

  /** Events of the last tick. */
  ranRedLight: boolean;
  overranStopLine: boolean;
  crashed: boolean;
  hitPedestrian: boolean;
  offRoad: boolean;
  arrived: boolean;
  lost: boolean;
  speeding: boolean;
  laneDeparture: boolean;
  wrongWay: boolean;
  hardBrake: boolean;

  /** Totals over the episode. */
  redLightRuns: number;
  stopLineOverruns: number;
  speedingTime: number;
  laneDepartureTime: number;
  wrongWayTime: number;
  hardBrakes: number;
  /** Seconds without progress that a red light, a car or a person ahead does not explain. */
  noProgress: number;
  /** True while stopped for a good reason: a red light, a car or a person ahead. */
  waiting: boolean;
  /** Light seen when the front crossed the next stop line, for the red light check at the box. */
  lineLight: number;
  lineStop: number;
  crashX: number;
  crashY: number;
  /** Cars and people the SUV overlaps right now, a bit per world index, so a contact is judged only on the tick it begins. */
  carContacts: Uint32Array;
  pedContacts: Uint32Array;
}

/**
 * A learner at the start of its route. Training puts every learner on slot
 * 0. The Sandbox lines extra cars up behind, `slot` car lengths back.
 */
export function createLearner(index: number, route: Route, rays: number, seed = index, slot = 0): DrivingLearner {
  const start = Math.max(0, route.startS - slot * 7);
  const p = route.path;
  const i = p.indexAt(start);
  const car = createCar(p.x[i], p.y[i], Math.atan2(p.ty[i], p.tx[i]));
  return {
    index,
    seed,
    car,
    status: STATUS_DRIVING,
    stopReason: null,
    fitness: 0,
    time: 0,
    progress: start,
    maxProgress: start,
    progressGain: 0,
    routeIndex: i,
    remaining: route.destS - start,
    lateral: 0,
    headingError: 0,
    aim: 0,
    inDestination: false,
    curveNear: 0,
    curveFar: 0,
    inIntersection: false,
    nextTurn: 0,
    turnDistance: 0,
    speedLimit: route.sampleLimit[i],
    sense: perception(),
    lidar: new Float64Array(rays),
    lidarKind: new Uint8Array(rays),
    ranRedLight: false,
    overranStopLine: false,
    crashed: false,
    hitPedestrian: false,
    offRoad: false,
    arrived: false,
    lost: false,
    speeding: false,
    laneDeparture: false,
    wrongWay: false,
    hardBrake: false,
    redLightRuns: 0,
    stopLineOverruns: 0,
    speedingTime: 0,
    laneDepartureTime: 0,
    wrongWayTime: 0,
    hardBrakes: 0,
    noProgress: 0,
    waiting: false,
    lineLight: -1,
    lineStop: -1,
    crashX: 0,
    crashY: 0,
    carContacts: new Uint32Array(Math.ceil(MAX_TRAFFIC / 32)),
    pedContacts: new Uint32Array(Math.ceil(MAX_PEDS / 32)),
  };
}

export function stopLearner(l: DrivingLearner, reason: string): void {
  if (l.status !== STATUS_DRIVING) return;
  l.stopReason = reason;
  l.status = reason === 'arrived' ? STATUS_ARRIVED : reason === 'crash' || reason === 'pedestrian' || reason === 'offroad' ? STATUS_CRASHED : STATUS_STOPPED;
  if (l.status === STATUS_CRASHED) {
    l.crashX = l.car.x;
    l.crashY = l.car.y;
  }
  l.car.speed = 0;
}

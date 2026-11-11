import type { DrivingResult } from '../results';

/**
 * One brain's outcome over every trip of a generation. Fitness and the
 * counts add up over the trips; `legs` keeps each trip's own result for the
 * benchmark, lessons and anything else that wants the detail. Plain data,
 * posted from the sim workers to the coordinator.
 */
export interface DrivingRunResult {
  fitness: number;
  /** Simulated seconds over every trip. */
  time: number;
  /** "arrived" when every trip arrived, else why the first trip that did not arrive ended. */
  stopReason: string | null;
  trips: number;
  arrivals: number;
  /** Arrivals with no crash, no person hit and no red light run. */
  safeArrivals: number;
  /** Trips that ended against another car, against a person, or off the road. */
  crashes: number;
  pedestrianHits: number;
  offRoads: number;
  /** Trips with at least one red light run. */
  redLightTrips: number;
  redLightRuns: number;
  stopLineOverruns: number;
  speedingTime: number;
  laneDepartureTime: number;
  wrongWayTime: number;
  curbTime: number;
  /** Share of each trip covered, averaged over the trips, 0 to 1. */
  completion: number;
  /** Meters driven along the routes, summed. */
  distance: number;
  /** Where the first crash of the generation happened, or NaN. */
  crashX: number;
  crashY: number;
  legs: DrivingResult[];
}

/** A brain's trips folded into one result. `legs` holds one result per trip played so far, in trip order. */
export function combineLegs(legs: DrivingResult[]): DrivingRunResult {
  const out: DrivingRunResult = {
    fitness: 0,
    time: 0,
    stopReason: null,
    trips: legs.length,
    arrivals: 0,
    safeArrivals: 0,
    crashes: 0,
    pedestrianHits: 0,
    offRoads: 0,
    redLightTrips: 0,
    redLightRuns: 0,
    stopLineOverruns: 0,
    speedingTime: 0,
    laneDepartureTime: 0,
    wrongWayTime: 0,
    curbTime: 0,
    completion: 0,
    distance: 0,
    crashX: NaN,
    crashY: NaN,
    legs,
  };
  for (const r of legs) {
    out.fitness += r.fitness;
    out.time += r.time;
    if (r.arrived) out.arrivals++;
    if (r.safe) out.safeArrivals++;
    if (r.stopReason === 'crash') out.crashes++;
    if (r.hitPedestrian) out.pedestrianHits++;
    if (r.stopReason === 'offroad') out.offRoads++;
    if (r.redLightRuns > 0) out.redLightTrips++;
    out.redLightRuns += r.redLightRuns;
    out.stopLineOverruns += r.stopLineOverruns;
    out.speedingTime += r.speedingTime;
    out.laneDepartureTime += r.laneDepartureTime;
    out.wrongWayTime += r.wrongWayTime;
    out.curbTime += r.curbTime;
    out.completion += r.completion / Math.max(1, legs.length);
    out.distance += r.distance;
    if (r.crashed && Number.isNaN(out.crashX)) {
      out.crashX = r.crashX;
      out.crashY = r.crashY;
    }
    if (out.stopReason === null && !r.arrived) out.stopReason = r.stopReason;
  }
  if (out.stopReason === null && legs.length > 0) out.stopReason = 'arrived';
  return out;
}

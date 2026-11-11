import type { DrivingResult } from '../../driving/results';
import type { DrivingRadar } from './axes';
import type { DrivingExamCourse } from './exam';

/**
 * How much each part counts toward the 0 to 100 score. Getting there and
 * getting there safely count the same and most; pace and doing it in
 * both cities count less. Changing any constant in this file changes
 * scores, so bump DRIVING_BENCHMARK_VERSION.
 */
export const DRIVING_WEIGHTS = { completion: 0.35, safety: 0.35, efficiency: 0.15, generalization: 0.15 } as const;

/** Safety lost per red light run and per stop line overrun on a trip. */
export const RED_LIGHT_COST = 0.5;
export const OVERRUN_COST = 0.2;
/**
 * The most completion a trip earns without arriving. Driving through the
 * destination, or parking a meter short of it, covers the whole route but
 * is not getting there, so only arriving earns the last tenth.
 */
export const SHORT_OF_ARRIVAL = 0.9;

/** One trip scored on the three per trip axes, each from 0 to 1. */
export interface TripScore {
  completion: number;
  safety: number;
  efficiency: number;
}

const clamp01 = (x: number) => (x > 0 ? (x < 1 ? x : 1) : 0);
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Completion is the share of the trip covered: 1 on arrival, and at most
 * SHORT_OF_ARRIVAL otherwise. Safety is that share again, times how
 * cleanly it was driven: nothing for a crash, a person hit or leaving the
 * road, less for each red light and each overrun, and less for the share
 * of the time spent speeding or on the wrong side. Scaling by the share
 * covered means a brain that parks at the start is not called safe.
 * Efficiency is the autopilot's time over the brain's, times how clean
 * the drive was, and only on an arrival: a brain that never got there has
 * no pace to speak of, and one that beat the autopilot by running its red
 * lights did not drive efficiently.
 */
export function scoreTrip(r: DrivingResult, course: DrivingExamCourse): TripScore {
  const covered = r.arrived ? 1 : Math.min(SHORT_OF_ARRIVAL, clamp01(r.distance / Math.max(1, course.par.length)));
  const time = Math.max(r.time, 1e-6);
  const ruleShare = (r.speedingTime + r.wrongWayTime + 0.5 * r.laneDepartureTime) / time;
  const clean = r.crashed ? 0 : clamp01(1 - RED_LIGHT_COST * r.redLightRuns - OVERRUN_COST * r.stopLineOverruns - ruleShare);
  const efficiency = r.arrived ? clean * clamp01(course.par.time / time) : 0;
  return { completion: covered, safety: covered * clean, efficiency };
}

/** The three axes averaged over trips. */
export function averageTrips(scores: readonly TripScore[]): TripScore {
  return {
    completion: mean(scores.map((s) => s.completion)),
    safety: mean(scores.map((s) => s.safety)),
    efficiency: mean(scores.map((s) => s.efficiency)),
  };
}

/** A group of trips' own 0 to 100 score: the composite without the part that compares cities. */
export function tripsScore(s: TripScore): number {
  const w = DRIVING_WEIGHTS.completion + DRIVING_WEIGHTS.safety + DRIVING_WEIGHTS.efficiency;
  return (100 * (DRIVING_WEIGHTS.completion * s.completion + DRIVING_WEIGHTS.safety * s.safety + DRIVING_WEIGHTS.efficiency * s.efficiency)) / w;
}

/**
 * The radar and the composite score. Generalization is the score in the
 * weaker of the two held out cities, from 0 to 1, so a brain that only
 * copes with one street layout scores low there even when it shines in
 * the other.
 */
export function drivingComposite(byCity: ReadonlyArray<readonly TripScore[]>): { radar: DrivingRadar; score: number } {
  const all = averageTrips(byCity.flat());
  const cities = byCity.map((trips) => tripsScore(averageTrips(trips)) / 100);
  const radar: DrivingRadar = { ...all, generalization: cities.length ? Math.min(...cities) : 0 };
  const w = DRIVING_WEIGHTS;
  const score = 100 * (w.completion * radar.completion + w.safety * radar.safety + w.efficiency * radar.efficiency + w.generalization * radar.generalization);
  return { radar, score };
}

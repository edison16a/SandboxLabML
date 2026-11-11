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

/** One trip scored on the three per trip axes, each from 0 to 1. */
export interface TripScore {
  completion: number;
  safety: number;
  efficiency: number;
}

const clamp01 = (x: number) => (x > 0 ? (x < 1 ? x : 1) : 0);
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Completion is the share of the trip covered, 1 on arrival. Safety is
 * that share again, times how cleanly it was driven: nothing for a crash,
 * a person hit or leaving the road, less for each red light and each
 * overrun, and less for the share of the time spent speeding or on the
 * wrong side. Scaling by the share covered means a brain that parks at the
 * start is not called safe. Efficiency is the autopilot's time over the
 * brain's on an arrival; short of the destination it is the brain's mean
 * pace against the autopilot's, scaled by the share covered.
 */
export function scoreTrip(r: DrivingResult, course: DrivingExamCourse): TripScore {
  const covered = r.arrived ? 1 : clamp01(r.distance / Math.max(1, course.par.length));
  const time = Math.max(r.time, 1e-6);
  const ruleShare = (r.speedingTime + r.wrongWayTime + 0.5 * r.laneDepartureTime) / time;
  const clean = r.crashed ? 0 : clamp01(1 - RED_LIGHT_COST * r.redLightRuns - OVERRUN_COST * r.stopLineOverruns - ruleShare);
  const parPace = course.par.length / Math.max(course.par.time, 1e-6);
  const efficiency = r.arrived ? clamp01(course.par.time / time) : covered * clamp01(r.distance / time / parPace);
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

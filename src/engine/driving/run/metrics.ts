import type { MetricSpec } from '../../env/metrics';
import type { ChampionRecord } from '../../training/records';
import { drivingLevel, MAX_LEVEL } from '../levels';
import type { DrivingContent } from './content';
import type { DrivingRunResult } from './results';

const percent = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '-');

/**
 * What a Driving run records. The generation metrics are shares of every
 * drive in the generation (brains times trips), so they compare across
 * population sizes and trip counts. The lab draws them in its own charts
 * (the curriculum, arrivals and safety), so they skip the generic picker.
 */
export const DRIVING_METRICS: readonly MetricSpec[] = [
  // A run card shows this as its headline, in a narrow column: "Level 2 of 5" fits where the level's name would not.
  { key: 'level', label: 'Level', unit: '', source: 'generation', better: 'higher', chart: false, summary: true, format: (v) => (Number.isFinite(v) ? `${drivingLevel(v).id} of ${MAX_LEVEL}` : '-') },
  { key: 'arrived', label: 'Arrived', unit: '%', source: 'generation', better: 'higher', chart: false, format: percent },
  { key: 'safe', label: 'Safe arrivals', unit: '%', source: 'generation', better: 'higher', chart: false, format: percent },
  { key: 'eliteSafe', label: 'Top fifth safe', unit: '%', source: 'generation', better: 'higher', chart: false, format: percent },
  { key: 'judged', label: 'Champions safe', unit: '%', source: 'generation', better: 'higher', chart: false, format: percent },
  { key: 'completion', label: 'Route covered', unit: '%', source: 'generation', better: 'higher', chart: false, format: percent },
  { key: 'crashes', label: 'Crashes', unit: '%', source: 'generation', better: 'lower', chart: false, format: percent },
  { key: 'pedestrians', label: 'People hit', unit: '%', source: 'generation', better: 'lower', chart: false, format: percent },
  { key: 'offRoad', label: 'Off the road', unit: '%', source: 'generation', better: 'lower', chart: false, format: percent },
  { key: 'redLights', label: 'Red lights', unit: '%', source: 'generation', better: 'lower', chart: false, format: percent },
  { key: 'route', label: 'Route', unit: '%', source: 'champion', better: 'higher', format: percent },
  { key: 'tripsArrived', label: 'Arrived', unit: '', source: 'champion', better: 'higher', format: percent },
];

/** The share of brains, best first by fitness, whose trips the curriculum judges. */
export const ELITE_SHARE = 0.2;

/**
 * Safe arrivals among the best fifth of the population by fitness, over
 * their trips. Most of a population are fresh mutants that crash, so the
 * whole population's share stays low even once the best brains drive
 * well; this is the share that says the run has learned the level.
 */
export function eliteSafeShare(results: readonly DrivingRunResult[]): number {
  if (results.length === 0) return 0;
  const order = results.map((_, i) => i).sort((a, b) => results[b].fitness - results[a].fitness || a - b);
  const top = order.slice(0, Math.max(1, Math.round(results.length * ELITE_SHARE)));
  let trips = 0;
  let safe = 0;
  for (const i of top) {
    trips += results[i].trips;
    safe += results[i].safeArrivals;
  }
  return safe / Math.max(1, trips);
}

/**
 * The safe share the curriculum moves on: safe arrivals of the champions
 * kept unchanged from the generation before, over this generation's new
 * trips. They became champions on other routes, so this share carries no
 * luck from the routes that picked them, as the best fifth's does. With no
 * kept champions (the first generation, or a script that keeps none) it
 * falls back to the best fifth.
 */
export function judgedSafeShare(results: readonly DrivingRunResult[], carried: readonly boolean[]): number {
  let trips = 0;
  let safe = 0;
  results.forEach((r, i) => {
    if (!carried[i]) return;
    trips += r.trips;
    safe += r.safeArrivals;
  });
  return trips > 0 ? safe / trips : eliteSafeShare(results);
}

/** Shares over every drive of a generation, keyed like DRIVING_METRICS. */
export function drivingGenerationMetrics(results: readonly DrivingRunResult[], content: DrivingContent, carried: readonly boolean[] = []): Record<string, number> {
  let drives = 0;
  const sum = { arrived: 0, safe: 0, completion: 0, crashes: 0, pedestrians: 0, offRoad: 0, redLights: 0 };
  for (const r of results) {
    drives += r.trips;
    sum.arrived += r.arrivals;
    sum.safe += r.safeArrivals;
    sum.completion += r.completion * r.trips;
    sum.crashes += r.crashes;
    sum.pedestrians += r.pedestrianHits;
    sum.offRoad += r.offRoads;
    sum.redLights += r.redLightTrips;
  }
  const n = Math.max(1, drives);
  return {
    level: content.level,
    arrived: sum.arrived / n,
    safe: sum.safe / n,
    eliteSafe: eliteSafeShare(results),
    judged: judgedSafeShare(results, carried),
    completion: sum.completion / n,
    crashes: sum.crashes / n,
    pedestrians: sum.pedestrians / n,
    offRoad: sum.offRoad / n,
    redLights: sum.redLights / n,
  };
}

/** The champion's own numbers: how much of its routes it covered and the share of its trips it finished. */
export function drivingChampionFields(r: DrivingRunResult): Omit<ChampionRecord, 'genomeId' | 'fitness' | 'stopReason'> {
  return { metrics: { route: r.completion, tripsArrived: r.arrivals / Math.max(1, r.trips) } };
}

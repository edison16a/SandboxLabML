import { presetBlueprints } from '../../blueprints/presets';
import { mixSeed } from '../../core/rng';
import type { DrivingLearner } from '../../driving/agent/learner';
import { drivingLevel } from '../../driving/levels';
import type { DrivingResult } from '../../driving/results';
import { drivingInputsOf } from '../../driving/run/inputs';
import { builtInInputCount } from '../../driving/sensors/inputSchema';
import { DRIVING_BENCHMARK_VERSION, DRIVING_ENGINE_VERSION } from '../../driving/version';
import { modelMetrics } from '../../neat/metrics';
import type { Genome } from '../../neat/types';
import { createScriptHost } from '../../script/host';
import type { RunConfig } from '../../training/runConfig';
import type { BenchOptions, BenchResult } from '../types';
import { driveExamCourse, type DrivingExamDriver } from './drive';
import { drivingExam, EXAM_LEVELS, type DrivingExamCourse } from './exam';
import { averageTrips, drivingComposite, scoreTrip, tripsScore, type TripScore } from './scoring';

/** Seed for sensor noise and script sensors during the exam. Fixed, so the same brain always scores the same. */
const BENCH_SEED = 0xd21e;

/**
 * What the exam needs from a run: the blueprint's inputs plus the custom
 * sensors of its latest script. Sensors are part of the brain's shape, so
 * every script version of a run has the same ones.
 */
function examDriverFor(config: RunConfig): DrivingExamDriver | null {
  if (config.env !== 'driving' || config.blueprint.env !== 'driving') return null;
  const source = config.scripts[config.scripts.length - 1]?.source;
  const host = source ? createScriptHost(source, { blueprints: [...presetBlueprints().map((b) => b.id), config.blueprint.id] }) : null;
  return {
    inputs: drivingInputsOf(config),
    customSensors: host?.customSensors ?? [],
    sensorsFor: (seed, _course, extra) => host?.createController<DrivingLearner>({ seed, extra }) ?? null,
  };
}

const share = (results: readonly DrivingResult[], test: (r: DrivingResult) => boolean) => (results.length ? results.filter(test).length / results.length : 0);
const safeArrival = (r: DrivingResult) => r.safe && !r.crashed;

/** Raw numbers for a group of trips, used per level and for the whole exam. */
function rawMetrics(results: readonly DrivingResult[]): Record<string, number> {
  return {
    arrived: share(results, (r) => r.arrived),
    safeArrivals: share(results, safeArrival),
    crashes: share(results, (r) => r.stopReason === 'crash'),
    pedestrianHits: share(results, (r) => r.hitPedestrian),
    offRoad: share(results, (r) => r.stopReason === 'offroad'),
    redLightRuns: results.reduce((n, r) => n + r.redLightRuns, 0),
  };
}

/**
 * The Driving exam: sixteen short trips in the two cities training never
 * uses, from traffic lights to rush hour, one brain alone on each. It
 * pauses inside every trip so the worker that runs it stays responsive.
 * Returns null when the signal aborts. Throws if the genome does not fit
 * the run's inputs, which means the caller passed a brain from another run.
 */
export async function benchmarkDriving(config: RunConfig, genome: Genome, opts: BenchOptions = {}): Promise<BenchResult | null> {
  const driver = examDriverFor(config);
  if (!driver) return null;
  const expected = builtInInputCount(driver.inputs) + driver.customSensors.length;
  if (genome.inputs.length !== expected) throw new Error(`This brain has ${genome.inputs.length} inputs, but the run gives ${expected}.`);

  const exam = await drivingExam();
  if (opts.signal?.aborted) return null;
  const results: Array<{ course: DrivingExamCourse; result: DrivingResult; score: TripScore }> = [];
  for (const [i, course] of exam.entries()) {
    const result = await driveExamCourse(genome, course, driver, mixSeed(BENCH_SEED, i), opts.signal);
    if (!result) return null;
    results.push({ course, result, score: scoreTrip(result, course) });
    opts.onProgress?.((i + 1) / exam.length);
  }
  const cities = [...new Set(exam.map((c) => c.city))];
  const { radar, score } = drivingComposite(cities.map((city) => results.filter((r) => r.course.city === city).map((r) => r.score)));
  const parts: BenchResult['parts'] = EXAM_LEVELS.map((level) => {
    const at = results.filter((r) => r.course.level === level);
    const trips = averageTrips(at.map((r) => r.score));
    return { id: `level-${level}`, label: drivingLevel(level).name, score: tripsScore(trips), metrics: { ...rawMetrics(at.map((r) => r.result)), ...trips } };
  });
  return {
    env: 'driving',
    benchmarkVersion: DRIVING_BENCHMARK_VERSION,
    engineVersion: DRIVING_ENGINE_VERSION,
    score,
    radar,
    metrics: rawMetrics(results.map((r) => r.result)),
    parts,
    scorePer100Params: (100 * score) / Math.max(1, modelMetrics(genome).parameters),
  };
}

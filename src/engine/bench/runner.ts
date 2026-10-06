import { PRESET_BLUEPRINTS } from '../blueprints/presets';
import { mixSeed } from '../core/rng';
import { BENCHMARK_VERSION, ENGINE_VERSION } from '../core/version';
import { modelMetrics } from '../neat/metrics';
import type { Genome } from '../neat/types';
import { builtInInputCount } from '../racing/sensors/inputSchema';
import { createScriptHost } from '../script/host';
import type { RunConfig } from '../training/runConfig';
import { driveCourse, type EpisodeResult, type ExamDriver } from './drive';
import { examTracks } from './exam';
import { averageScores, composite, scoreEpisode, trackScore } from './scoring';
import type { BenchResult } from './types';

/** Seed for sensor noise and script sensors during the exam. Fixed, so the same brain always scores the same. */
const BENCH_SEED = 0xbe7c;

export interface BenchOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * What the exam needs from a run: the blueprint's inputs plus the custom
 * sensors of its script. Sensors are part of the brain's shape, so every
 * script version of a run has the same ones and the latest is used.
 */
function examDriverFor(config: RunConfig): ExamDriver | null {
  if (config.env !== 'racing' || config.blueprint.env !== 'racing') return null;
  const source = config.scripts[config.scripts.length - 1]?.source;
  const host = source ? createScriptHost(source, { blueprints: [...PRESET_BLUEPRINTS.map((b) => b.id), config.blueprint.id] }) : null;
  return {
    inputs: config.blueprint.inputs,
    customSensors: host?.customSensors ?? [],
    sensorsFor: (seed, course) => host?.createRacingController(seed, course.track) ?? null,
  };
}

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Raw numbers for a group of episodes, used for each track and for the whole exam. */
function rawMetrics(results: EpisodeResult[]): Record<string, number> {
  const lapTimes = results.filter((r) => r.laps > 0).map((r) => r.bestLapTime);
  return {
    laps: results.reduce((s, r) => s + r.laps, 0),
    lapTime: lapTimes.length ? Math.min(...lapTimes) : 0,
    distance: mean(results.map((r) => r.distance)),
    crashRate: mean(results.map((r) => (r.crashed ? 1 : 0))),
    steerChange: mean(results.map((r) => r.steerChange)),
  };
}

/**
 * Racing exam: every road, every start, one episode each, with a pause
 * between episodes so the page stays responsive. Returns null when the
 * signal aborts. Throws if the genome does not fit the run's inputs,
 * which means the caller passed a brain from a different run.
 */
export async function benchmarkRacing(config: RunConfig, genome: Genome, opts: BenchOptions = {}): Promise<BenchResult | null> {
  const driver = examDriverFor(config);
  if (!driver) return null;
  const expected = builtInInputCount(driver.inputs) + driver.customSensors.length;
  if (genome.inputs.length !== expected) throw new Error(`This brain has ${genome.inputs.length} inputs, but the run gives ${expected}.`);

  const exam = examTracks();
  const total = exam.reduce((n, t) => n + t.courses.length, 0);
  let done = 0;
  const parts: BenchResult['parts'] = [];
  const perTrack = [];
  const everything: EpisodeResult[] = [];
  for (const [ti, track] of exam.entries()) {
    const results: EpisodeResult[] = [];
    for (const [ci, course] of track.courses.entries()) {
      if (opts.signal?.aborted) return null;
      results.push(driveCourse(genome, course, driver, mixSeed(BENCH_SEED, ti, ci)));
      opts.onProgress?.(++done / total);
      await pause();
    }
    const scores = averageScores(results.map((r, ci) => scoreEpisode(r, track.courses[ci])));
    perTrack.push(scores);
    everything.push(...results);
    parts.push({ id: track.id, label: track.label, score: trackScore(scores), metrics: { ...rawMetrics(results), ...scores } });
  }
  if (opts.signal?.aborted) return null;
  const { radar, score } = composite(perTrack);
  const parameters = modelMetrics(genome).parameters;
  return {
    env: 'racing',
    benchmarkVersion: BENCHMARK_VERSION,
    engineVersion: ENGINE_VERSION,
    score,
    radar,
    metrics: rawMetrics(everything),
    parts,
    scorePer100Params: (100 * score) / Math.max(1, parameters),
  };
}

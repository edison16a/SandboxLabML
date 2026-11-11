import { presetBlueprints } from '../../blueprints/presets';
import { mixSeed } from '../../core/rng';
import type { NavAgent } from '../../navigation/agent';
import { NAV_LEVELS } from '../../navigation/course/levels';
import { NAVIGATION_ENGINE_VERSION } from '../../navigation/params';
import { navigationOf } from '../../navigation/pipeline/settings';
import { navigationInputCount } from '../../navigation/sensors/inputConfig';
import { modelMetrics } from '../../neat/metrics';
import type { Genome } from '../../neat/types';
import { createScriptHost } from '../../script/host';
import type { RunConfig } from '../../training/runConfig';
import type { BenchOptions, BenchResult } from '../types';
import { NAVIGATION_BENCHMARK_VERSION } from './axes';
import { EXAM_LEVELS, examRooms } from './exam';
import { averageRuns, composite, partScore, scoreRun, type ExamRun, type RunScore } from './scoring';
import { walkRoom, type ExamWalker } from './walk';

/** Seed for sensor noise and script sensors during the exam. Fixed, so the same brain always scores the same. */
const BENCH_SEED = 0xbe7c;

/**
 * What the exam needs from a run: the blueprint's inputs plus the custom
 * sensors of its script. Sensors are part of the brain's shape, so every
 * script version of a run has the same ones and the latest is used.
 */
function examWalkerFor(config: RunConfig): ExamWalker | null {
  if (config.env !== 'navigation') return null;
  const { inputs } = navigationOf(config);
  const source = config.scripts[config.scripts.length - 1]?.source;
  const host = source ? createScriptHost(source, { blueprints: [...presetBlueprints().map((b) => b.id), config.blueprint.id] }) : null;
  return {
    inputs,
    customSensors: host?.customSensors ?? [],
    sensorsFor: (seed, room) => host?.createController<NavAgent>({ seed, extra: { level: room.level, course: room.course } }) ?? null,
  };
}

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Raw numbers for a group of runs: how often it finished and died, how far it got, and its mean time to the line. */
function rawMetrics(runs: ExamRun[]): Record<string, number> {
  const finished = runs.filter((r) => r.finished);
  return {
    finishRate: mean(runs.map((r) => (r.finished ? 1 : 0))),
    deathRate: mean(runs.map((r) => (r.died ? 1 : 0))),
    progress: mean(runs.map((r) => (r.finished ? 1 : r.progress))),
    finishTime: mean(finished.map((r) => r.finishTime)),
  };
}

/**
 * The Navigation exam: every held out room of levels 1 to 6, from three
 * start spots each, one runner alone each time, with a pause between rooms
 * so the page stays responsive. Returns null when the signal aborts.
 * Throws if the genome does not fit the run's inputs, which means the
 * caller passed a brain from another run.
 */
export async function benchmarkNavigation(config: RunConfig, genome: Genome, opts: BenchOptions = {}): Promise<BenchResult | null> {
  const walker = examWalkerFor(config);
  if (!walker) return null;
  const expected = navigationInputCount(walker.inputs) + walker.customSensors.length;
  if (genome.inputs.length !== expected) throw new Error(`This brain has ${genome.inputs.length} inputs, but the run gives ${expected}.`);

  const rooms = examRooms();
  const runs = new Map<number, ExamRun[]>(EXAM_LEVELS.map((l) => [l, []]));
  for (const [i, room] of rooms.entries()) {
    if (opts.signal?.aborted) return null;
    runs.get(room.level)?.push(...walkRoom(genome, room, walker, mixSeed(BENCH_SEED, i)));
    opts.onProgress?.((i + 1) / rooms.length);
    await pause();
  }
  if (opts.signal?.aborted) return null;

  const byLevel: RunScore[][] = [];
  const parts: BenchResult['parts'] = [];
  for (const level of EXAM_LEVELS) {
    const levelRuns = runs.get(level) ?? [];
    const scores = levelRuns.map(scoreRun);
    const avg = averageRuns(scores);
    byLevel.push(scores);
    parts.push({ id: `level-${level}`, label: `${level} ${NAV_LEVELS[level].name}`, score: partScore(avg), metrics: { ...rawMetrics(levelRuns), completion: avg.completion, efficiency: avg.efficiency, ...(avg.safety === null ? {} : { safety: avg.safety }) } });
  }
  const { radar, score } = composite(byLevel);
  const parameters = modelMetrics(genome).parameters;
  return {
    env: 'navigation',
    benchmarkVersion: NAVIGATION_BENCHMARK_VERSION,
    engineVersion: NAVIGATION_ENGINE_VERSION,
    score,
    radar,
    metrics: rawMetrics([...runs.values()].flat()),
    parts,
    scorePer100Params: (100 * score) / Math.max(1, parameters),
  };
}

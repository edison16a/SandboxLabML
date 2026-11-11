import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { DrivingReferenceModel } from '../../../src/engine/bench/driving/models';
import { REFERENCE_TIERS, summarizeCurve } from '../../../src/engine/bench/references';
import type { BenchReferences, ReferenceTier } from '../../../src/engine/bench/types';
import { DRIVING_BENCHMARK_VERSION, DRIVING_ENGINE_VERSION } from '../../../src/engine/driving/version';
import { checkpoints } from '../checkpoints';
import { numberArg, writeReferences, type Args } from '../file';
import type { JobPool } from '../pool';
import { pickDrivingModel } from './pick';
import type { DrivingReferenceJob, DrivingReferenceResult } from './train';

/** A Driving reference file: the shared curves plus the models the Sandbox can drive. */
type DrivingReferences = BenchReferences & { models: DrivingReferenceModel[] };

/** The model a tier ships (see pickDrivingModel), with how often it arrived safely on the pick's trips logged and left out of the file. */
function modelOf(tier: ReferenceTier, runs: DrivingReferenceResult[]): DrivingReferenceModel {
  const { sandboxShare, ...model } = pickDrivingModel(tier, runs);
  console.log(`${tier} model: seed ${model.seed}, generation ${model.generation}, benchmark ${model.score}, safe on ${Math.round(sandboxShare * 100)}% of Sandbox trips`);
  return model;
}

/**
 * Keeps the old date when nothing but the date would change, models
 * included. Training is deterministic, so a rerun on an unchanged engine
 * writes the same file.
 */
function stableDate(path: string, next: DrivingReferences): DrivingReferences {
  if (!existsSync(path)) return next;
  try {
    const old = JSON.parse(readFileSync(path, 'utf8')) as DrivingReferences;
    return JSON.stringify({ ...old, generatedAt: '' }) === JSON.stringify({ ...next, generatedAt: '' }) ? { ...next, generatedAt: old.generatedAt } : next;
  } catch {
    return next;
  }
}

/**
 * Regenerates public/references/driving.json. For each Driving preset tier
 * it trains several seeds with a population of 100 on the settings a new
 * run uses (Midtown, the automatic curriculum, three trips), benchmarks
 * the champion every few generations, keeps the median and middle half of
 * the scores at each checkpoint, and ships each tier's most reliable
 * champion as a model the Sandbox can drive (see pickDrivingModel).
 *
 * Options: --seeds 6, --first-seed 1, --generations 200, --every 10,
 * --population 100, --tiers beginner,intermediate,advanced, --out file,
 * --dump file (every run's checkpoints and champions as JSON, to study),
 * --from-dump file (build the file from such a dump without training).
 * A smoke run: --seeds 1 --generations 4 --every 2 --population 20.
 */
export async function generateDriving(args: Args, pool: JobPool): Promise<void> {
  const seeds = numberArg(args, 'seeds', 6);
  const firstSeed = numberArg(args, 'first-seed', 1);
  const generations = numberArg(args, 'generations', 200);
  const every = numberArg(args, 'every', 10);
  const population = numberArg(args, 'population', 100);
  const out = args.out ?? 'public/references/driving.json';
  const tiers = args.tiers ? (args.tiers.split(',') as ReferenceTier[]) : [...REFERENCE_TIERS];
  // Advanced first: runs that climb further drive busier streets and take longer, so they start early.
  const jobs: DrivingReferenceJob[] = [...tiers].reverse().flatMap((tier) => Array.from({ length: seeds }, (_, i) => ({ kind: 'driving' as const, tier, seed: firstSeed + i, generations, every, population })));
  if (!args['from-dump']) console.log(`Driving reference runs: ${tiers.length} tiers x ${seeds} seeds, ${generations} generations, population ${population}.`);
  const started = performance.now();
  // A dump from an earlier run skips the training and only builds the file again, with the current picking rules.
  const results = args['from-dump']
    ? (JSON.parse(readFileSync(args['from-dump'], 'utf8')) as DrivingReferenceResult[])
    : await pool.run<DrivingReferenceResult>(jobs, (r) =>
        console.log(`${r.job.tier} seed ${r.job.seed}: final ${r.scores[r.scores.length - 1].toFixed(1)}, level ${r.levels[r.levels.length - 1]}, in ${r.seconds.toFixed(0)} s`),
      );
  if (args.dump) writeFileSync(args.dump, JSON.stringify(results));
  const file = referenceFile(results, tiers);
  writeReferences(out, stableDate(out, file));
  for (const r of file.references) console.log(`${r.tier}: final median ${r.finalScore}`);
  console.log(`Wrote ${out} in ${((performance.now() - started) / 1000).toFixed(0)} s.`);
}

/** The reference file from finished runs: each tier's curve, from the median and middle half of its seeds, and its model. */
function referenceFile(results: readonly DrivingReferenceResult[], tiers: readonly ReferenceTier[]): DrivingReferences {
  const first = results[0].job;
  const gens = checkpoints(first.generations, first.every);
  const byTier = (tier: ReferenceTier) => results.filter((r) => r.job.tier === tier).sort((a, b) => a.job.seed - b.job.seed);
  // The last two checkpoints: the curriculum keeps moving the level, so one checkpoint alone swings with it.
  const references = tiers.map((tier) => summarizeCurve(tier, gens, byTier(tier).map((r) => r.scores), 2));
  return {
    env: 'driving',
    benchmarkVersion: DRIVING_BENCHMARK_VERSION,
    engineVersion: DRIVING_ENGINE_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    seeds: new Set(results.map((r) => r.job.seed)).size,
    references,
    models: tiers.map((tier) => modelOf(tier, byTier(tier))),
  };
}

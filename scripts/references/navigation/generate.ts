import { readFileSync, writeFileSync } from 'node:fs';
import { NAVIGATION_BENCHMARK_VERSION } from '../../../src/engine/bench/navigation/axes';
import { quantile, REFERENCE_TIERS, summarizeCurve } from '../../../src/engine/bench/references';
import type { ReferenceModel, ReferenceTier } from '../../../src/engine/bench/types';
import { linkScriptCompiler } from '../../../src/engine/lessons/compilerLink';
import { NAV_LEVELS } from '../../../src/engine/navigation/course/levels';
import { NAVIGATION_ENGINE_VERSION } from '../../../src/engine/navigation/params';
import { checkpoints } from '../checkpoints';
import { numberArg, writeReferences, type Args } from '../file';
import type { JobPool } from '../pool';
import { pickNavigationModel } from './pick';
import { SANDBOX_COURSES } from './sandboxCourses';
import type { NavigationReferenceJob, NavigationReferenceResult } from './train';

/** Checkpoints pooled into a preset's final score. One champion swings a few points between checkpoints, so three say more. */
const FINAL_WINDOW = 3;

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** The model a tier ships (see pickNavigationModel). How it finishes goes to the log, not the file. */
async function modelOf(tier: ReferenceTier, runs: NavigationReferenceResult[], tierScore: number): Promise<ReferenceModel> {
  const { finish, shares, check, ...model } = await pickNavigationModel(tier, runs, tierScore);
  // The first layout of each level, in level order: what a visitor opens the Sandbox on.
  const levels = NAV_LEVELS.map((l) => SANDBOX_COURSES.findIndex((c) => c.label === `level ${l.level}`))
    .map((i) => `${SANDBOX_COURSES[i].label} ${percent(shares[i])}`)
    .join(', ');
  console.log(
    `${tier} model: seed ${model.seed}, generation ${model.generation}, benchmark ${model.score}, finishes ${percent(finish)} weighted on the Sandbox courses (${levels}), ${percent(check)} on fresh layouts`,
  );
  return model;
}

/** Runs from one or more dumps, comma separated. */
function readDumps(list: string): NavigationReferenceResult[] {
  return list.split(',').flatMap((path) => JSON.parse(readFileSync(path, 'utf8')) as NavigationReferenceResult[]);
}

/**
 * Regenerates public/references/navigation.json. For each Navigation
 * preset tier it trains several seeds with 100 runners on the default
 * curriculum, benchmarks the champion every few generations and keeps the
 * median and the middle half of the scores at each checkpoint, plus one
 * model per tier that finishes the Sandbox courses (see pickNavigationModel).
 *
 * Options: --seeds 8, --first-seed 1, --generations 60, --every 5,
 * --population 100, --tiers beginner,intermediate,advanced (a subset is
 * for experiments), --out public/references/navigation.json, --dump
 * file.json (every run with its candidate champions), --from-dump
 * a.json,b.json (build the file from dumps without training).
 */
export async function generateNavigation(args: Args, pool: JobPool): Promise<void> {
  const seeds = numberArg(args, 'seeds', 8);
  const firstSeed = numberArg(args, 'first-seed', 1);
  const generations = numberArg(args, 'generations', 60);
  const every = numberArg(args, 'every', 5);
  const population = numberArg(args, 'population', 100);
  const out = args.out ?? 'public/references/navigation.json';
  const tiers = args.tiers ? (args.tiers.split(',') as ReferenceTier[]) : [...REFERENCE_TIERS];
  const jobs: NavigationReferenceJob[] = tiers.flatMap((tier) =>
    Array.from({ length: seeds }, (_, i) => ({ kind: 'navigation' as const, tier, seed: firstSeed + i, generations, every, population })),
  );
  if (!args['from-dump']) console.log(`Navigation reference runs: ${tiers.length} tiers x ${seeds} seeds, ${generations} generations, population ${population}.`);
  const started = performance.now();
  const results = args['from-dump']
    ? readDumps(args['from-dump'])
    : await pool.run<NavigationReferenceResult>(jobs, (r) =>
        console.log(`${r.job.tier} seed ${r.job.seed}: final ${r.scores[r.scores.length - 1].toFixed(1)} on level ${r.levels[r.levels.length - 1]} in ${r.seconds.toFixed(0)} s`),
      );
  if (args.dump) writeFileSync(args.dump, JSON.stringify(results));
  // The pick runs the presets' scripts in the Sandbox replay's way, on this thread.
  linkScriptCompiler();
  const first = results[0].job;
  const gens = checkpoints(first.generations, first.every);
  const byTier = tiers.map((tier) => results.filter((r) => r.job.tier === tier).sort((a, b) => a.job.seed - b.job.seed));
  const references = tiers.map((tier, i) =>
    summarizeCurve(
      tier,
      gens,
      byTier[i].map((r) => r.scores),
      FINAL_WINDOW,
    ),
  );
  const models: ReferenceModel[] = [];
  for (const [i, tier] of tiers.entries()) models.push(await modelOf(tier, byTier[i], references[i].finalScore));
  writeReferences(out, {
    env: 'navigation',
    benchmarkVersion: NAVIGATION_BENCHMARK_VERSION,
    engineVersion: NAVIGATION_ENGINE_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    seeds: new Set(results.map((r) => r.job.seed)).size,
    references,
    models,
  });
  for (const [i, r] of references.entries()) {
    const level = quantile(
      byTier[i].map((x) => x.levels[x.levels.length - 1]),
      0.5,
    );
    console.log(`${r.tier}: final median ${r.finalScore}, median final level ${level}`);
  }
  console.log(`Wrote ${out} in ${((performance.now() - started) / 1000).toFixed(0)} s.`);
}

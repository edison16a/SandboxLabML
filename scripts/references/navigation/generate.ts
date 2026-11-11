import { writeFileSync } from 'node:fs';
import { NAVIGATION_BENCHMARK_VERSION } from '../../../src/engine/bench/navigation/axes';
import { quantile, REFERENCE_TIERS, summarizeCurve } from '../../../src/engine/bench/references';
import type { ReferenceModel, ReferenceTier } from '../../../src/engine/bench/types';
import { compileScript } from '../../../src/engine/script/compiler';
import { NAVIGATION_PRESETS } from '../../../src/engine/script/presets/navigation';
import { NAVIGATION_ENGINE_VERSION } from '../../../src/engine/navigation/params';
import { checkpoints } from '../checkpoints';
import { numberArg, writeReferences, type Args } from '../file';
import type { JobPool } from '../pool';
import type { NavigationReferenceJob, NavigationReferenceResult } from './train';

/** Checkpoints pooled into a preset's final score. One champion swings a few points between checkpoints, so three say more. */
const FINAL_WINDOW = 3;

/**
 * The shipped model of a tier: the last champion of the seed whose final
 * score sits in the middle of the tier's seeds, so it is typical of the
 * preset rather than its luckiest run.
 */
function typicalModel(tier: ReferenceTier, runs: NavigationReferenceResult[], generations: number): ReferenceModel {
  const sorted = [...runs].sort((a, b) => a.scores[a.scores.length - 1] - b.scores[b.scores.length - 1] || a.job.seed - b.job.seed);
  const mid = sorted[Math.floor((sorted.length - 1) / 2)];
  const preset = NAVIGATION_PRESETS.find((p) => p.tier === tier)!;
  const brain = compileScript(preset.source).script?.header.brain ?? 'navigation-standard';
  return { tier, seed: mid.job.seed, generation: generations, score: Math.round(mid.scores[mid.scores.length - 1] * 10) / 10, blueprint: brain, preset: preset.id, genome: mid.champion };
}

/**
 * Regenerates public/references/navigation.json. For each Navigation
 * preset tier it trains several seeds with 100 runners on the default
 * curriculum, benchmarks the champion every few generations and keeps the
 * median and the middle half of the scores at each checkpoint, plus one
 * typical final champion per tier for the Sandbox.
 *
 * Options: --seeds 8, --first-seed 1, --generations 60, --every 5,
 * --population 100, --tiers beginner,intermediate,advanced (a subset is
 * for experiments), --out public/references/navigation.json, --raw
 * file.json (every seed's scores and levels, for tuning).
 */
export async function generateNavigation(args: Args, pool: JobPool): Promise<void> {
  const seeds = numberArg(args, 'seeds', 8);
  const firstSeed = numberArg(args, 'first-seed', 1);
  const generations = numberArg(args, 'generations', 60);
  const every = numberArg(args, 'every', 5);
  const population = numberArg(args, 'population', 100);
  const out = args.out ?? 'public/references/navigation.json';
  const tiers = args.tiers ? (args.tiers.split(',') as ReferenceTier[]) : [...REFERENCE_TIERS];
  const jobs: NavigationReferenceJob[] = tiers.flatMap((tier) => Array.from({ length: seeds }, (_, i) => ({ kind: 'navigation' as const, tier, seed: firstSeed + i, generations, every, population })));
  console.log(`Navigation reference runs: ${tiers.length} tiers x ${seeds} seeds, ${generations} generations, population ${population}.`);
  const started = performance.now();
  const results = await pool.run<NavigationReferenceResult>(jobs, (r) =>
    console.log(`${r.job.tier} seed ${r.job.seed}: final ${r.scores[r.scores.length - 1].toFixed(1)} on level ${r.levels[r.levels.length - 1]} in ${r.seconds.toFixed(0)} s`),
  );
  const gens = checkpoints(generations, every);
  const byTier = tiers.map((tier) => results.filter((r) => r.job.tier === tier).sort((a, b) => a.job.seed - b.job.seed));
  const references = tiers.map((tier, i) =>
    summarizeCurve(
      tier,
      gens,
      byTier[i].map((r) => r.scores),
      FINAL_WINDOW,
    ),
  );
  writeReferences(out, {
    env: 'navigation',
    benchmarkVersion: NAVIGATION_BENCHMARK_VERSION,
    engineVersion: NAVIGATION_ENGINE_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    seeds,
    references,
    models: tiers.map((tier, i) => typicalModel(tier, byTier[i], generations)),
  });
  if (args.raw) writeFileSync(args.raw, JSON.stringify(results.map((r) => ({ ...r.job, scores: r.scores, levels: r.levels }))));
  for (const [i, r] of references.entries()) {
    const level = quantile(
      byTier[i].map((x) => x.levels[x.levels.length - 1]),
      0.5,
    );
    console.log(`${r.tier}: final median ${r.finalScore}, median final level ${level}`);
  }
  console.log(`Wrote ${out} in ${((performance.now() - started) / 1000).toFixed(0)} s.`);
}

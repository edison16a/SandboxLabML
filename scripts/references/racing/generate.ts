import { writeFileSync } from 'node:fs';
import { REFERENCE_TIERS, summarizeCurve } from '../../../src/engine/bench/references';
import type { ReferenceTier } from '../../../src/engine/bench/types';
import { BENCHMARK_VERSION, ENGINE_VERSION } from '../../../src/engine/core/version';
import { checkpoints } from '../checkpoints';
import { numberArg, writeReferences, type Args } from '../file';
import type { JobPool } from '../pool';
import type { RacingReferenceJob, RacingReferenceResult } from './train';

/**
 * Regenerates public/references/racing.json. For each Racing preset tier
 * it trains several seeds with a population of 100 and benchmarks the
 * champion every few generations, then keeps the median and the middle
 * half of the scores at each checkpoint.
 *
 * Options: --seeds 12, --first-seed 1, --generations 100, --every 5,
 * --population 100, --tiers beginner,intermediate,advanced (a subset is
 * for experiments), --out public/references/racing.json, --raw file.json
 * (every seed's scores, for tuning).
 */
export async function generateRacing(args: Args, pool: JobPool): Promise<void> {
  const seeds = numberArg(args, 'seeds', 12);
  const firstSeed = numberArg(args, 'first-seed', 1);
  const generations = numberArg(args, 'generations', 100);
  const every = numberArg(args, 'every', 5);
  const population = numberArg(args, 'population', 100);
  const out = args.out ?? 'public/references/racing.json';
  const keepGenomes = Boolean(args.raw);
  const tiers = args.tiers ? (args.tiers.split(',') as ReferenceTier[]) : [...REFERENCE_TIERS];
  const jobs: RacingReferenceJob[] = tiers.flatMap((tier) =>
    Array.from({ length: seeds }, (_, i) => ({ kind: 'racing' as const, tier, seed: firstSeed + i, generations, every, population, keepGenomes })),
  );
  console.log(`Racing reference runs: ${tiers.length} tiers x ${seeds} seeds, ${generations} generations, population ${population}.`);
  const started = performance.now();
  const results = await pool.run<RacingReferenceResult>(jobs, (r) =>
    console.log(`${r.job.tier} seed ${r.job.seed}: final ${r.scores[r.scores.length - 1].toFixed(1)} in ${r.seconds.toFixed(0)} s`),
  );
  const gens = checkpoints(generations, every);
  const references = tiers.map((tier) => {
    const runs = results.filter((r) => r.job.tier === tier).sort((a, b) => a.job.seed - b.job.seed);
    return summarizeCurve(
      tier,
      gens,
      runs.map((r) => r.scores),
    );
  });
  writeReferences(out, {
    env: 'racing',
    benchmarkVersion: BENCHMARK_VERSION,
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    seeds,
    references,
  });
  if (args.raw) writeFileSync(args.raw, JSON.stringify(results.map((r) => ({ ...r.job, scores: r.scores, genomes: r.genomes }))));
  for (const r of references) console.log(`${r.tier}: final median ${r.finalScore}`);
  console.log(`Wrote ${out} in ${((performance.now() - started) / 1000).toFixed(0)} s.`);
}

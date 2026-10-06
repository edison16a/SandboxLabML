import { writeFileSync } from 'node:fs';
import { opponentOf } from '../../../src/engine/bench/hideseek/opponents';
import { hideSeekResult } from '../../../src/engine/bench/hideseek/result';
import { REFERENCE_TIERS, summarizeCurve } from '../../../src/engine/bench/references';
import type { ReferenceTier } from '../../../src/engine/bench/types';
import { ENGINE_VERSION, HIDESEEK_BENCHMARK_VERSION } from '../../../src/engine/core/version';
import { hideSeekBlueprints } from '../../../src/engine/training/hideseekRunConfig';
import { checkpoints } from '../checkpoints';
import { numberArg, writeReferences, type Args } from '../file';
import type { JobPool } from '../pool';
import type { HideSeekExamJob, HideSeekExamResult } from './exam';
import { checkChampions, pickChampions, rateChampions } from './pick';
import type { HideSeekTrainJob, HideSeekTrainResult } from './train';
import type { HideSeekYardstickJob, HideSeekYardstickResult } from './yardstick';

const secondsSince = (t: number) => ((performance.now() - t) / 1000).toFixed(0);

/**
 * Regenerates public/references/hideseek.json in four steps: train every
 * preset tier on several seeds, pick each tier's reference champion pair,
 * rate the three pairs against each other, then score every checkpoint
 * champion of every run against them for the curves.
 *
 * The defaults are the nightly numbers: 5 seeds of 60 generations at 50
 * per team, about 50 minutes on four cores. A shared machine can pass
 * fewer, as the shipped file documents in docs/benchmark.md.
 *
 * Options: --seeds 5, --first-seed 1, --generations 60, --every 10,
 * --population 50 (per team), --out public/references/hideseek.json,
 * --raw file.json (every exam's games, for tuning the scoring offline).
 */
export async function generateHideSeek(args: Args, pool: JobPool): Promise<void> {
  const seeds = numberArg(args, 'seeds', 5);
  const firstSeed = numberArg(args, 'first-seed', 1);
  const generations = numberArg(args, 'generations', 60);
  const every = numberArg(args, 'every', 10);
  const population = numberArg(args, 'population', 50);
  const out = args.out ?? 'public/references/hideseek.json';
  const tiers: readonly ReferenceTier[] = REFERENCE_TIERS;
  const started = performance.now();
  console.log(`Hide and Seek reference runs: ${tiers.length} tiers x ${seeds} seeds, ${generations} generations, ${population} per team.`);

  const trainJobs: HideSeekTrainJob[] = tiers.flatMap((tier) => Array.from({ length: seeds }, (_, i) => ({ kind: 'hideseek-train' as const, tier, seed: firstSeed + i, generations, every, population })));
  const runs = await pool.run<HideSeekTrainResult>(trainJobs, (r) => console.log(`${r.job.tier} seed ${r.job.seed}: trained in ${r.seconds.toFixed(0)} s`));

  const brains = (run: HideSeekTrainResult) => hideSeekBlueprints(run.config);
  const yardJobs: HideSeekYardstickJob[] = runs.map((r) => {
    const last = r.pairs[r.pairs.length - 1];
    return { kind: 'hideseek-yardstick', id: `${r.job.tier}:${r.job.seed}`, hider: { genome: last.hider, inputs: brains(r).hider.inputs }, seeker: { genome: last.seeker, inputs: brains(r).seeker.inputs } };
  });
  const yardsticks = new Map((await pool.run<HideSeekYardstickResult>(yardJobs)).map((y) => [y.id, y]));
  const picked = pickChampions(runs, yardsticks, tiers);
  checkChampions(picked);
  console.log(`Reference champions: ${picked.map((c) => `${c.tier} seed ${c.seed}`).join(', ')} (${secondsSince(started)} s so far).`);

  const examJobs: HideSeekExamJob[] = [
    ...picked.map((c) => ({ kind: 'hideseek-exam' as const, id: `ref:${c.tier}`, ...opponentBrains(c), opponents: picked })),
    ...runs.flatMap((r) =>
      r.pairs.map((p) => ({
        kind: 'hideseek-exam' as const,
        id: `${r.job.tier}:${r.job.seed}:${p.generation}`,
        hider: { genome: p.hider, inputs: brains(r).hider.inputs },
        seeker: { genome: p.seeker, inputs: brains(r).seeker.inputs },
        opponents: picked,
      })),
    ),
  ];
  const exams = new Map((await pool.run<HideSeekExamResult>(examJobs)).map((e) => [e.id, e]));
  const champions = rateChampions(picked, (tier) => exams.get(`ref:${tier}`)?.games ?? []);
  const opponents = champions.map(opponentOf);
  const scoreOf = (id: string) => {
    const e = exams.get(id);
    return e ? hideSeekResult(e.games, opponents, e.parameters).score : 0;
  };

  const gens = checkpoints(generations, every);
  const references = tiers.map((tier) => {
    const tierRuns = runs.filter((r) => r.job.tier === tier).sort((a, b) => a.job.seed - b.job.seed);
    return summarizeCurve(tier, gens, tierRuns.map((r) => gens.map((g) => scoreOf(`${tier}:${r.job.seed}:${g}`))));
  });
  writeReferences(out, {
    env: 'hideseek',
    benchmarkVersion: HIDESEEK_BENCHMARK_VERSION,
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    seeds,
    references,
    champions,
  });
  if (args.raw) writeFileSync(args.raw, JSON.stringify({ champions, yardsticks: [...yardsticks.values()], exams: [...exams.values()] }));
  for (const r of references) console.log(`${r.tier}: final median ${r.finalScore}, rating ${champions.find((c) => c.tier === r.tier)?.rating}, reference pair scores ${scoreOf(`ref:${r.tier}`).toFixed(1)}`);
  console.log(`Wrote ${out} in ${secondsSince(started)} s.`);
}

/** A reference champion's brains decoded for an exam job. */
function opponentBrains(c: Parameters<typeof opponentOf>[0]): Pick<HideSeekExamJob, 'hider' | 'seeker'> {
  const side = opponentOf(c).side;
  return { hider: { genome: side.hider.genome, inputs: side.hider.inputs }, seeker: { genome: side.seeker.genome, inputs: side.seeker.inputs } };
}

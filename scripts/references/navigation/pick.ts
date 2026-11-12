import { findPresetBlueprint } from '../../../src/engine/blueprints/presets';
import { benchmarkNavigation } from '../../../src/engine/bench/navigation/runner';
import type { ReferenceModel, ReferenceTier } from '../../../src/engine/bench/types';
import type { NavigationInputConfig } from '../../../src/engine/navigation/sensors/inputConfig';
import { base64ToBytes, decodeGenome } from '../../../src/engine/neat/serialize';
import { compileScript } from '../../../src/engine/script/compiler';
import { NAVIGATION_PRESETS } from '../../../src/engine/script/presets/navigation';
import { CHECK_COURSES, courseShares, SANDBOX_COURSES, weightedFinish } from './sandboxCourses';
import { navigationReferenceConfig, type NavigationCandidate, type NavigationReferenceResult } from './train';

/** Champions per tier with the best Sandbox finishes that take the benchmark before the pick. */
const SHORTLIST = 12;

/** A shortlisted champion: its weighted Sandbox finish share and its benchmark score. */
export interface Contender {
  finish: number;
  score: number;
  generation: number;
}

/**
 * The contender that ships: the best Sandbox finisher among those that
 * score at least the tier's pooled final score on the benchmark, so the
 * label never claims more than the preset's typical run reaches. When
 * none does, the best finisher of all. A tie goes to the higher score,
 * then the later generation.
 */
export function chooseContender<T extends Contender>(list: readonly T[], tierScore: number): T {
  const typical = list.filter((c) => c.score >= tierScore);
  const pool = typical.length ? typical : list;
  return [...pool].sort((a, b) => b.finish - a.finish || b.score - a.score || b.generation - a.generation)[0];
}

/** A shipped model with how it did, for the log and docs/benchmark.md. None of this goes in the file. */
export interface PickedNavigationModel extends ReferenceModel {
  /** Weighted finish share on the Sandbox courses. */
  finish: number;
  /** Finish share per course on SANDBOX_COURSES, and the mean on fresh layouts no pick saw. */
  shares: number[];
  check: number;
}

/** A run's candidates. A dump from before candidates existed has only the last champion. */
function candidatesOf(run: NavigationReferenceResult): NavigationCandidate[] {
  if (run.candidates?.length) return run.candidates;
  return [{ generation: run.job.generations, level: run.levels[run.levels.length - 1] ?? 0, genome: run.champion, score: run.scores[run.scores.length - 1] }];
}

/**
 * The model a tier ships. Every distinct champion from the second half of
 * every seed's training runs the Sandbox courses a visitor meets (see
 * SANDBOX_COURSES), eight copies at a time as the Sandbox lines them up.
 * The best finishers take the benchmark, and chooseContender picks among
 * them. Its finish share on fresh layouts is reported beside it.
 */
export async function pickNavigationModel(tier: ReferenceTier, runs: readonly NavigationReferenceResult[], tierScore: number): Promise<PickedNavigationModel> {
  const preset = NAVIGATION_PRESETS.find((p) => p.tier === tier);
  const brain = preset ? (compileScript(preset.source).script?.header.brain ?? 'navigation-starter') : null;
  const blueprint = brain ? findPresetBlueprint(brain) : undefined;
  if (!preset || blueprint?.env !== 'navigation') throw new Error(`No navigation preset for tier ${tier}`);
  const inputs = blueprint.inputs as NavigationInputConfig;
  const all = runs.flatMap((run) =>
    candidatesOf(run).map((c) => {
      const shares = courseShares(c.genome, inputs, run.job.seed, preset.source, SANDBOX_COURSES);
      return { run, c, shares, finish: weightedFinish(shares), generation: c.generation };
    }),
  );
  const shortlist = all.sort((a, b) => b.finish - a.finish || b.generation - a.generation).slice(0, SHORTLIST);
  const scored = [];
  for (const e of shortlist) {
    const score = e.c.score ?? (await benchmarkNavigation(navigationReferenceConfig(e.run.job), decodeGenome(base64ToBytes(e.c.genome))))?.score ?? 0;
    scored.push({ ...e, score });
  }
  const best = chooseContender(scored, tierScore);
  const check = courseShares(best.c.genome, inputs, best.run.job.seed, preset.source, CHECK_COURSES);
  return {
    tier,
    seed: best.run.job.seed,
    generation: best.c.generation,
    score: Math.round(best.score * 10) / 10,
    blueprint: blueprint.id,
    preset: preset.id,
    genome: best.c.genome,
    finish: best.finish,
    shares: best.shares,
    check: weightedFinish(check, CHECK_COURSES),
  };
}

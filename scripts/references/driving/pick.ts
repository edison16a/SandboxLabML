import { benchmarkDriving } from '../../../src/engine/bench/driving/runner';
import type { DrivingReferenceModel } from '../../../src/engine/bench/driving/models';
import type { ReferenceTier } from '../../../src/engine/bench/types';
import type { DrivingInputConfig } from '../../../src/engine/driving/sensors/inputConfig';
import { base64ToBytes, decodeGenome } from '../../../src/engine/neat/serialize';
import { CHECK_TRIPS, PICK_TRIPS, sandboxShares, SCREEN_TRIPS, weightedShare } from './sandboxTrips';
import { drivingReferenceConfig, type DrivingCandidate, type DrivingReferenceResult } from './train';

/** Champions per tier that pass the screen and drive the full pick trips. */
const SHORTLIST = 10;

/** A shipped model with how it did, for the log and docs/benchmark.md. None of this goes in the file. */
export interface PickedDrivingModel extends DrivingReferenceModel {
  /** Weighted safe share on the pick trips. */
  pickShare: number;
  /** Safe share per Sandbox level on trips the pick never saw. */
  checkShares: number[];
}

interface Entry {
  run: DrivingReferenceResult;
  candidate: DrivingCandidate;
}

/**
 * A run's candidates. A dump written before candidates existed only has
 * the benchmarked checkpoints, which are screened here instead.
 */
function candidatesOf(run: DrivingReferenceResult): DrivingCandidate[] {
  if (run.candidates) return run.candidates;
  const inputs = run.champion.inputs as DrivingInputConfig;
  return run.checkpoints
    .filter((c) => c.generation >= run.job.generations / 2)
    .map((c) => ({ generation: c.generation, level: c.level, genome: c.genome, screen: sandboxShares(c.genome, inputs, run.job.seed, SCREEN_TRIPS) }));
}

/**
 * The model a tier ships: the champion that arrives safely most often in
 * the Sandbox, where a newcomer watches it. Every distinct champion from
 * the second half of every seed's training was screened on a few trips per
 * level. The best SHORTLIST of those drive thirty fresh trips per level,
 * three copies at a time as the Sandbox lines them up, and the best
 * weighted share wins (LEVEL_WEIGHTS favors level 2, where every newcomer
 * starts). A final champion, which an early version shipped, won its
 * generation on one lucky score over three trips and often parked short
 * of the first light. Its reliability is then measured on a third set of
 * trips, so the number reported is not the one it was picked on.
 */
export async function pickDrivingModel(tier: ReferenceTier, runs: readonly DrivingReferenceResult[]): Promise<PickedDrivingModel> {
  const entries: Entry[] = runs.flatMap((run) => candidatesOf(run).map((candidate) => ({ run, candidate })));
  const shortlist = entries
    .sort((a, b) => weightedShare(b.candidate.screen) - weightedShare(a.candidate.screen) || b.candidate.generation - a.candidate.generation)
    .slice(0, SHORTLIST);
  let best: { entry: Entry; share: number } | null = null;
  for (const entry of shortlist) {
    const { run, candidate } = entry;
    const share = weightedShare(sandboxShares(candidate.genome, run.champion.inputs as DrivingInputConfig, run.job.seed, PICK_TRIPS));
    if (!best || share > best.share) best = { entry, share };
  }
  if (!best) throw new Error(`No ${tier} champion to ship.`);
  const { run, candidate } = best.entry;
  const inputs = run.champion.inputs as DrivingInputConfig;
  // A checkpoint already has its benchmark; any other champion takes the exam now, for the label the Sandbox shows.
  const known = run.checkpoints.find((c) => c.genome === candidate.genome)?.score;
  const score = known ?? (await benchmarkDriving(drivingReferenceConfig(run.job), decodeGenome(base64ToBytes(candidate.genome))))?.score ?? 0;
  return {
    tier,
    seed: run.job.seed,
    generation: candidate.generation,
    score: Math.round(score * 10) / 10,
    blueprint: run.champion.blueprint,
    inputs,
    genome: candidate.genome,
    pickShare: best.share,
    checkShares: sandboxShares(candidate.genome, inputs, run.job.seed, CHECK_TRIPS),
  };
}

import { benchmarkDriving } from '../../../src/engine/bench/driving/runner';
import type { DrivingReferenceModel } from '../../../src/engine/bench/driving/models';
import type { ReferenceTier } from '../../../src/engine/bench/types';
import type { DrivingInputConfig } from '../../../src/engine/driving/sensors/inputConfig';
import { base64ToBytes, decodeGenome } from '../../../src/engine/neat/serialize';
import { CHECK_TRIPS, PICK_TRIPS, sandboxShares, SCREEN_TRIPS, weightedShare } from './sandboxTrips';
import { drivingReferenceConfig, type DrivingCandidate, type DrivingReferenceResult } from './train';

/** Champions per tier with the best weighted screen that drive the full pick trips. */
const SHORTLIST = 16;
/** Champions added to the shortlist for their screen at traffic and rush hour, where few do well. */
const BUSY_SHORTLIST = 8;
/** The level 2 share a shipped model should reach on the pick trips: every newcomer watches it there first. */
export const LEVEL2_FLOOR = 0.85;

/** A champion's safe share per Sandbox level on the pick trips, with what it is picked on. */
export interface DriverResult {
  shares: number[];
  generation: number;
}

/**
 * The driver that ships: the best weighted safe share among those that
 * reach LEVEL2_FLOOR at level 2, or among all when none does. A tie goes
 * to the better level 2 share, then the later generation.
 */
export function chooseDriver<T extends DriverResult>(list: readonly T[]): T {
  const steady = list.filter((d) => d.shares[0] >= LEVEL2_FLOOR);
  const pool = steady.length ? steady : list;
  return [...pool].sort((a, b) => weightedShare(b.shares) - weightedShare(a.shares) || b.shares[0] - a.shares[0] || b.generation - a.generation)[0];
}

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
 * the second half of every seed's training was screened on a few trips
 * per level. The best of those, plus the few that cope with traffic,
 * drive twenty five fresh trips per level, three copies at a time as the
 * Sandbox lines them up, and chooseDriver picks among them. A final
 * champion, which an early version shipped, won its generation on one
 * lucky score over three trips and often parked short of the first light.
 * The pick's reliability is then measured on a third set of trips, so the
 * number reported is not the one it was picked on.
 */
export async function pickDrivingModel(tier: ReferenceTier, runs: readonly DrivingReferenceResult[]): Promise<PickedDrivingModel> {
  const entries: Entry[] = runs.flatMap((run) => candidatesOf(run).map((candidate) => ({ run, candidate })));
  const byScreen = [...entries].sort((a, b) => weightedShare(b.candidate.screen) - weightedShare(a.candidate.screen) || b.candidate.generation - a.candidate.generation);
  // The screen sees only a few trips per level, so a champion that copes with traffic gets its own way onto the shortlist.
  const busy = entries.filter((e) => e.candidate.screen[0] >= 0.75).sort((a, b) => b.candidate.screen[2] + b.candidate.screen[3] - (a.candidate.screen[2] + a.candidate.screen[3]));
  const shortlist = [...new Set([...byScreen.slice(0, SHORTLIST), ...busy.slice(0, BUSY_SHORTLIST)])];
  const tried = shortlist.map((entry) => {
    const { run, candidate } = entry;
    const shares = sandboxShares(candidate.genome, run.champion.inputs as DrivingInputConfig, run.job.seed, PICK_TRIPS);
    console.log(`  ${tier} seed ${run.job.seed} generation ${candidate.generation} (level ${candidate.level}): ${shares.map((x) => Math.round(x * 100)).join(' ')}`);
    return { entry, shares, generation: candidate.generation };
  });
  const best = tried.length ? chooseDriver(tried) : null;
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
    pickShare: weightedShare(best.shares),
    checkShares: sandboxShares(candidate.genome, inputs, run.job.seed, CHECK_TRIPS),
  };
}

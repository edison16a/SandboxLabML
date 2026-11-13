import { existsSync, readFileSync } from 'node:fs';
import { parseDrivingModels, type DrivingReferenceModel } from '../../../src/engine/bench/driving/models';
import { DRIVING_BENCHMARK_VERSION, DRIVING_ENGINE_VERSION } from '../../../src/engine/driving/version';
import type { PickedDrivingModel } from './pick';
import { CHECK_TRIPS, sandboxShares, SANDBOX_LEVELS, weightedShare } from './sandboxTrips';

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** One line of the log: a model's safe share per level and weighted, with its benchmark. */
function describe(label: string, model: DrivingReferenceModel, shares: readonly number[]): string {
  const levels = SANDBOX_LEVELS.map((l, i) => `level ${l} ${percent(shares[i])}`).join(', ');
  return `  ${label}: seed ${model.seed}, generation ${model.generation}, benchmark ${model.score}, weighted ${percent(weightedShare(shares))}, ${levels}`;
}

/**
 * The models in the file a run is about to replace, when they were
 * trained on the same engine and judged by the same exam. Models of
 * another version may not even fit their inputs any more, so none are
 * returned for them.
 */
export function shippedModels(path: string): DrivingReferenceModel[] {
  if (!existsSync(path)) return [];
  try {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const file = data as { benchmarkVersion?: unknown; engineVersion?: unknown };
    if (file.benchmarkVersion !== DRIVING_BENCHMARK_VERSION || file.engineVersion !== DRIVING_ENGINE_VERSION) return [];
    return parseDrivingModels(data);
  } catch {
    return [];
  }
}

/** A shipped model's safe share per Sandbox level on the check trips, played the way the Sandbox plays it. */
export type CheckDrive = (model: DrivingReferenceModel) => number[];

const onCheckTrips: CheckDrive = (m) => sandboxShares(m.genome, m.inputs, m.seed, CHECK_TRIPS);

/** A weighted safe share as the file stores it, to a tenth of a percent. */
export function storedShare(shares: readonly number[]): number {
  return Math.round(weightedShare(shares) * 1000) / 1000;
}

/**
 * The model each tier ships: the new pick, unless the model it would
 * replace drives the check trips more safely. Both drive the same unseen
 * trips, three copies each, and the weighted safe share decides, a tie
 * going to the new pick. A new set of seeds can simply be unluckier than
 * the last, and a regenerated file should never hand a newcomer a worse
 * driver. Either way the model ships with the share it drove here, which
 * the Sandbox picks by. A kept model is otherwise copied unchanged, so a
 * rerun on the same engine keeps it again and writes the same file.
 */
export function keepBetterModels(picked: readonly PickedDrivingModel[], old: readonly DrivingReferenceModel[], drive: CheckDrive = onCheckTrips): DrivingReferenceModel[] {
  return picked.map(({ pickShare: _pick, checkShares, ...pick }) => {
    const model: DrivingReferenceModel = { ...pick, safeShare: storedShare(checkShares) };
    const before = old.find((m) => m.tier === model.tier);
    if (!before) return model;
    const shares = drive(before);
    const keep = weightedShare(shares) > weightedShare(checkShares);
    console.log(`${model.tier} model against the one it replaces, on ${CHECK_TRIPS.trips} unseen trips per level:`);
    console.log(describe('new pick', model, checkShares));
    console.log(describe('shipped', before, shares));
    console.log(`  ships the ${keep ? 'shipped one again' : 'new pick'}`);
    return keep ? { ...before, safeShare: storedShare(shares) } : model;
  });
}

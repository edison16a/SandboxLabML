import { mixSeed } from '../../../src/engine/core/rng';
import { DEFAULT_CITY_ID } from '../../../src/engine/driving/city/presets';
import { drivingModule } from '../../../src/engine/driving/module';
import type { DrivingRunResult } from '../../../src/engine/driving/run/results';
import { sandboxCapacity, sandboxSetup, type SandboxTrip } from '../../../src/engine/driving/sandbox';
import type { DrivingInputConfig } from '../../../src/engine/driving/sensors/inputConfig';
import { Network } from '../../../src/engine/neat/network';
import { base64ToBytes, decodeGenome } from '../../../src/engine/neat/serialize';
import type { Genome } from '../../../src/engine/neat/types';
import { hostFor } from '../../../src/engine/training/scriptHost';

/**
 * The levels the Sandbox can open on. A new run opens it on level 2, and a
 * trained run on the level its training reached (firstSandbox in
 * src/features/driving/sandbox/state.ts), so a shipped model has to cope
 * with all four.
 */
export const SANDBOX_LEVELS = [2, 3, 4, 5] as const;

/**
 * How much each level counts when models are compared. Every newcomer
 * sees level 2 first, so it weighs the most. Reference runs spend their
 * last generations at level 4, so a trained run opens there far more often
 * than on level 3, which runs pass through, or rush hour, which few reach.
 */
export const LEVEL_WEIGHTS = [0.4, 0.15, 0.35, 0.1] as const;

/** Copies of the model the Sandbox lines up, as STARTING_MODEL_COPIES in src/features/driving/sandbox/state.ts. */
export const MODEL_COPIES = 3;

/** The replay worker's controller seed (GHOST_CONTROLLER_SALT in src/workers/replay/ghostPlayer.ts). */
const REPLAY_CONTROLLER_SEED = mixSeed(0x9405);

/** A set of Sandbox trips: `trips` routes per level, picked by `salt`. */
export interface TripSet {
  salt: number;
  trips: number;
}

/** A quick look at every champion during training, to shortlist the promising ones. */
export const SCREEN_TRIPS: TripSet = { salt: 0x5c, trips: 4 };
/** The trips the shortlist is judged on. */
export const PICK_TRIPS: TripSet = { salt: 0x5b, trips: 25 };
/** More trips for the few best of the shortlist, so the last call rests on fifty per level. */
export const FINAL_TRIPS: TripSet = { salt: 0x5d, trips: 25 };
/**
 * Trips no pick ever looks at, which the reported reliability comes from
 * and on which a new pick meets the model it would replace. Sixty per
 * level keep a share within a few points. The shipped model test drives
 * the first twenty of them.
 */
export const CHECK_TRIPS: TripSet = { salt: 0x5a, trips: 60 };

/**
 * Share of the SUVs that arrive safely on one Sandbox trip, played the way
 * the Sandbox replays the trained model: copies of it lined up nose to
 * tail at the start (as many as fit, up to MODEL_COPIES), each with the
 * model's own seed, under the built in rules.
 */
export function tripSafeShare(genome: Genome, inputs: DrivingInputConfig, seed: number, trip: SandboxTrip): number {
  const cars = Math.min(MODEL_COPIES, sandboxCapacity(trip));
  const env = drivingModule.createEnv({ trips: [sandboxSetup(trip, cars)], inputs, scriptSource: null }, hostFor(null), REPLAY_CONTROLLER_SEED);
  env.reset(
    Array.from({ length: cars }, () => new Network(genome)),
    Array.from({ length: cars }, () => seed),
    Array.from({ length: cars }, (_, slot) => slot),
  );
  while (!env.done) env.step();
  let safe = 0;
  for (const r of env.results() as DrivingRunResult[]) safe += r.safeArrivals;
  return safe / cars;
}

/** Safe share of a champion on a trip set, one number per SANDBOX_LEVELS entry, in the default city. */
export function sandboxShares(genome: string, inputs: DrivingInputConfig, seed: number, set: TripSet): number[] {
  const brain = decodeGenome(base64ToBytes(genome));
  return SANDBOX_LEVELS.map((level) => {
    let sum = 0;
    for (let k = 0; k < set.trips; k++) sum += tripSafeShare(brain, inputs, seed, { city: DEFAULT_CITY_ID, level, seed: mixSeed(set.salt, k), destination: null });
    return sum / set.trips;
  });
}

/** One number for a list of per level shares, with LEVEL_WEIGHTS. */
export function weightedShare(shares: readonly number[]): number {
  return shares.reduce((sum, s, i) => sum + s * (LEVEL_WEIGHTS[i] ?? 0), 0);
}

import type { DrivingReferenceModel } from '../../../src/engine/bench/driving/models';
import type { ReferenceTier } from '../../../src/engine/bench/types';
import { mixSeed } from '../../../src/engine/core/rng';
import { drivingModule } from '../../../src/engine/driving/module';
import type { DrivingRunResult } from '../../../src/engine/driving/run/results';
import { DEFAULT_CITY_ID } from '../../../src/engine/driving/city/presets';
import { sandboxSetup } from '../../../src/engine/driving/sandbox';
import type { DrivingInputConfig } from '../../../src/engine/driving/sensors/inputConfig';
import { Network } from '../../../src/engine/neat/network';
import { base64ToBytes, decodeGenome } from '../../../src/engine/neat/serialize';
import { hostFor } from '../../../src/engine/training/scriptHost';
import type { DrivingReferenceResult } from './train';

/** The level the Sandbox opens on for a new run (see firstSandbox in src/features/driving/sandbox/state.ts). */
export const SANDBOX_LEVEL = 2;
/** Trips each candidate drives. */
const PICK_TRIPS = 40;
/** Salt of those trips, apart from the shipped model test's, so the pick is not tuned to the test. */
const PICK_SALT = 0x5b;

/**
 * Share of Sandbox trips a champion arrives on safely: the Sandbox's own
 * first trip on many routes in the default city, alone, with the built in
 * rules the Sandbox replay uses.
 */
export function sandboxSafeShare(genome: string, inputs: DrivingInputConfig, seed: number, level = SANDBOX_LEVEL, trips = PICK_TRIPS): number {
  const brain = new Network(decodeGenome(base64ToBytes(genome)));
  let safe = 0;
  for (let k = 0; k < trips; k++) {
    const trip = sandboxSetup({ city: DEFAULT_CITY_ID, level, seed: mixSeed(PICK_SALT, k), destination: null }, 1);
    const env = drivingModule.createEnv({ trips: [trip], inputs, scriptSource: null }, hostFor(null), 1);
    env.reset([brain], [seed], [0]);
    while (!env.done) env.step();
    safe += (env.results()[0] as DrivingRunResult).safeArrivals;
  }
  return safe / trips;
}

/**
 * The model a tier ships: the most reliable driver its runs produced.
 * Every champion benchmarked in the second half of any seed's training
 * drives the Sandbox's first trip on forty routes, and the one that
 * arrives safely most often wins, the better benchmark score breaking a
 * tie. A typical final champion, which an earlier version shipped, was
 * picked for one lucky score over three trips and often parked short of
 * the first light; "Try a trained model" is meant to show a skilled SUV.
 */
export function pickDrivingModel(tier: ReferenceTier, runs: readonly DrivingReferenceResult[]): DrivingReferenceModel & { sandboxShare: number } {
  let best: (DrivingReferenceModel & { sandboxShare: number }) | null = null;
  for (const r of runs) {
    const inputs = r.champion.inputs as DrivingInputConfig;
    for (const c of r.checkpoints.filter((k) => k.generation >= r.job.generations / 2)) {
      const share = sandboxSafeShare(c.genome, inputs, r.job.seed);
      if (best && (share < best.sandboxShare || (share === best.sandboxShare && c.score <= best.score))) continue;
      best = { tier, seed: r.job.seed, generation: c.generation, score: Math.round(c.score * 10) / 10, blueprint: r.champion.blueprint, inputs, genome: c.genome, sandboxShare: share };
    }
  }
  if (!best) throw new Error(`No ${tier} champion to ship.`);
  return best;
}

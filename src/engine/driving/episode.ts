import type { DrivingBrain, DrivingEnvOptions } from './env';
import { DrivingEnv } from './env';
import type { DrivingResult } from './results';

/** Runs a whole episode headless: every brain drives until all have stopped. */
export function evaluateDriving(brains: DrivingBrain[], opts: DrivingEnvOptions, seeds: number[] = []): DrivingResult[] {
  const env = new DrivingEnv(opts);
  env.reset(brains, seeds);
  while (!env.done) env.step();
  return env.results();
}

import { Network } from '../neat/network';
import type { Genome } from '../neat/types';
import { RacingEnv, type RacingEnvOptions } from './env';
import type { RacingResult } from './result';

export { resultOf, type RacingResult } from './result';

/**
 * Runs a whole generation headless: all genomes drive together until every
 * car has stopped. Returns one result per genome, in order.
 */
export function evaluateRacing(genomes: Genome[], opts: RacingEnvOptions, seeds: number[] = []): RacingResult[] {
  const env = new RacingEnv(opts);
  env.reset(
    genomes.map((g) => new Network(g)),
    seeds,
  );
  while (!env.done) env.step();
  return env.results();
}

/** Path of one car as flat [x, y, heading, speed] per tick, for path caches and tests. */
export function recordPath(genome: Genome, opts: RacingEnvOptions, seed = 0, maxTicks = 1800): Float32Array {
  const env = new RacingEnv(opts);
  env.reset([new Network(genome)], [seed]);
  const out: number[] = [];
  const snap = new Float32Array(8);
  while (!env.done && env.tick < maxTicks) {
    env.step();
    env.snapshot(snap);
    out.push(snap[0], snap[1], snap[2], snap[3]);
  }
  return Float32Array.from(out);
}

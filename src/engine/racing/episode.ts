import { Network } from '../neat/network';
import type { Genome } from '../neat/types';
import { STATUS_CRASHED, type RacingCar } from './car/runtime';
import { RacingEnv, type RacingEnvOptions } from './env';

/** Per-car outcome of an episode, used for fitness and the champion record. */
export interface RacingResult {
  fitness: number;
  /** Meters driven along the road. */
  distance: number;
  laps: number;
  bestLapTime: number;
  crashed: boolean;
  crashX: number;
  crashY: number;
  stopReason: string | null;
  time: number;
}

export function resultOf(rc: RacingCar): RacingResult {
  return {
    fitness: rc.fitness,
    distance: rc.maxProgress,
    laps: rc.lap,
    bestLapTime: rc.bestLapTime,
    crashed: rc.status === STATUS_CRASHED,
    crashX: rc.crashX,
    crashY: rc.crashY,
    stopReason: rc.stopReason,
    time: rc.time,
  };
}

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
  return env.cars.map(resultOf);
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

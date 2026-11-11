import { describe, expect, it } from 'vitest';
import { Network } from '../../neat/network';
import { Population } from '../../neat/population';
import { builtinHost } from '../../training/scriptHost';
import { DEFAULT_DRIVING_BLUEPRINT } from '../blueprints';
import { builtInInputCount } from '../sensors/inputSchema';
import { DRIVING_SNAPSHOT, WORLD_SIZE } from '../snapshot';
import type { DrivingContent } from './content';
import { drivingGenerationMetrics, eliteSafeShare } from './metrics';
import { combineLegs, type DrivingRunResult } from './results';
import { contentTrips, type DrivingRunSetup } from './setup';
import { tripOf, tripsOf } from './tripHeader';
import { DrivingTrips, TRIP_HOLD } from './trips';

const inputs = DEFAULT_DRIVING_BLUEPRINT.inputs;
const content: DrivingContent = { city: 'midtown', level: 2, curriculum: null, trips: 2, tripSeed: 77 };
const setup: DrivingRunSetup = { trips: contentTrips(content), inputs, scriptSource: null };
const brains = (n: number) =>
  Population.create({ inputCount: builtInInputCount(inputs), outputCount: 2, activation: 'tanh', wiring: 'direct' }, 5, { populationSize: n }).genomes.map((g) => new Network(g));

function drive(n: number, seeds: number[]) {
  const env = new DrivingTrips(setup, builtinHost, 9);
  const b = brains(n);
  env.reset(b, seeds);
  const header = new Float32Array(n * DRIVING_SNAPSHOT.stride + WORLD_SIZE);
  const trips = new Set<number>();
  while (!env.done) {
    env.step();
    env.writeSnapshot(header, 0);
    env.writeWorld(header, n * DRIVING_SNAPSHOT.stride);
    trips.add(tripOf(header, n * DRIVING_SNAPSHOT.stride));
    expect(tripsOf(header, n * DRIVING_SNAPSHOT.stride)).toBe(2);
  }
  return { env, results: env.results(), trips };
}

describe('a generation of several trips', () => {
  it('drives every trip in turn and adds the fitness up', () => {
    const { results, trips } = drive(6, [1, 2, 3, 4, 5, 6]);
    expect([...trips].sort()).toEqual([0, 1]);
    for (const r of results) {
      expect(r.trips).toBe(2);
      expect(r.legs).toHaveLength(2);
      expect(r.fitness).toBeCloseTo(r.legs[0].fitness + r.legs[1].fitness, 9);
      expect(r.time).toBeCloseTo(r.legs[0].time + r.legs[1].time, 9);
    }
  });

  it('replays a brain alone exactly as it drove in the population', () => {
    const together = drive(6, [1, 2, 3, 4, 5, 6]).results[3];
    const env = new DrivingTrips(setup, builtinHost, 9);
    env.reset([brains(6)[3]], [4]);
    while (!env.done) env.step();
    const alone = env.results()[0];
    expect(alone.fitness).toBe(together.fitness);
    expect(alone.legs.map((l) => l.stopReason)).toEqual(together.legs.map((l) => l.stopReason));
  });

  it('holds the finished scene of a trip before the next starts', () => {
    const env = new DrivingTrips(setup, builtinHost, 9);
    env.reset(brains(2), [1, 2]);
    let ended = -1;
    while (env.tripIndex === 0 && !env.done) {
      env.step();
      if (ended < 0 && env.current.done) ended = env.tick;
    }
    expect(env.tick - ended).toBe(TRIP_HOLD);
  });
});

function result(fitness: number, arrivals: number, trips = 2): DrivingRunResult {
  const r = combineLegs([]);
  return { ...r, fitness, trips, arrivals, safeArrivals: arrivals };
}

describe('driving generation metrics', () => {
  it('counts shares over every drive', () => {
    const m = drivingGenerationMetrics([result(10, 2), result(1, 0), result(5, 1)], content);
    expect(m.level).toBe(2);
    expect(m.arrived).toBeCloseTo(3 / 6);
    expect(m.safe).toBeCloseTo(3 / 6);
  });

  it('judges the best fifth by fitness', () => {
    const results = Array.from({ length: 10 }, (_, i) => result(i, i >= 8 ? 2 : 0));
    expect(eliteSafeShare(results)).toBe(1);
    expect(eliteSafeShare(results.map((r) => ({ ...r, fitness: -r.fitness })))).toBe(0);
  });

  it('folds trips into one result', () => {
    const { results } = drive(3, [1, 2, 3]);
    const r = combineLegs(results[0].legs);
    expect(r).toEqual(results[0]);
  });
});

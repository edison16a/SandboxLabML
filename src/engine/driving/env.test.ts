import { describe, expect, it } from 'vitest';
import { Network } from '../neat/network';
import { Population } from '../neat/population';
import { Autopilot } from './autopilot/autopilot';
import { autopilotController, IDLE_BRAIN } from './autopilot/controller';
import { builtinDrivingController } from './builtinReward';
import { SUV } from './car/params';
import { DrivingEnv, type DrivingBrain } from './env';
import { STANDARD_DRIVING_INPUTS } from './sensors/inputConfig';
import { builtInInputCount } from './sensors/inputSchema';
import { createDrivingSetup, drivingEnvOptions } from './setup';
import { DRIVING_SNAPSHOT, readWorld, WORLD_SIZE } from './snapshot';
import { createWorldState } from './world/state';

const inputs = STANDARD_DRIVING_INPUTS;
const brains = (n: number, seed: number): Network[] => Population.create({ inputCount: builtInInputCount(inputs), outputCount: 2, activation: 'tanh', wiring: 'direct' }, seed, { populationSize: n }).genomes.map((g) => new Network(g));

function run(env: DrivingEnv, b: DrivingBrain[], seeds: number[], ticks = 1e9): Float32Array[] {
  env.reset(b, seeds);
  const frames: Float32Array[] = [];
  while (!env.done && env.tick < ticks) {
    env.step();
    const f = new Float32Array(b.length * DRIVING_SNAPSHOT.stride);
    env.snapshot(f);
    frames.push(f);
  }
  return frames;
}

describe('DrivingEnv', () => {
  const setup = createDrivingSetup({ level: 5, seed: 21 });

  it('is deterministic: same brains and seeds, same drive', () => {
    const a = run(new DrivingEnv(drivingEnvOptions(setup, SUV, inputs, builtinDrivingController)), brains(12, 3), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 600);
    const b = run(new DrivingEnv(drivingEnvOptions(setup, SUV, inputs, builtinDrivingController)), brains(12, 3), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 600);
    expect(a.length).toBe(b.length);
    expect(a[a.length - 1]).toEqual(b[b.length - 1]);
  });

  it('replays a champion alone exactly as it drove among the population', () => {
    const many = brains(10, 7);
    const together = run(new DrivingEnv(drivingEnvOptions(setup, SUV, inputs, builtinDrivingController)), many, many.map((_, i) => 100 + i), 900);
    const alone = run(new DrivingEnv(drivingEnvOptions(setup, SUV, inputs, builtinDrivingController)), [brains(10, 7)[4]], [104], 900);
    const stride = DRIVING_SNAPSHOT.stride;
    for (let t = 0; t < alone.length; t++) for (let k = 0; k < stride; k++) expect(alone[t][k]).toBe(together[t][4 * stride + k]);
  });

  it('writes a world snapshot that reads back the same', () => {
    const env = new DrivingEnv(drivingEnvOptions(setup, SUV, inputs, builtinDrivingController));
    env.reset([IDLE_BRAIN]);
    for (let t = 0; t < 90; t++) env.step();
    const buf = new Float32Array(WORLD_SIZE);
    env.writeWorld(buf);
    const back = createWorldState(env.opts.city.signals.length);
    readWorld(buf, back);
    const w = env.world.state;
    expect(back.carCount).toBe(w.carCount);
    expect(back.pedCount).toBe(w.pedCount);
    expect(back.carX[3]).toBeCloseTo(w.carX[3], 3);
    expect(Array.from(back.lights)).toEqual(Array.from(w.lights));
  });

  it('reports results and a leader for every learner', () => {
    const env = new DrivingEnv(drivingEnvOptions(setup, SUV, inputs, builtinDrivingController));
    const b = brains(6, 9);
    env.reset(b);
    while (!env.done) env.step();
    const results = env.results();
    expect(results.length).toBe(6);
    expect(env.leaderIndex()).toBeGreaterThanOrEqual(0);
    for (const r of results) expect(r.stopReason).not.toBeNull();
  });
});

describe('autopilot', () => {
  for (let level = 1; level <= 5; level++) {
    it(`completes trips safely at level ${level}`, () => {
      for (const seed of [2, 5, 8]) {
        const setup = createDrivingSetup({ level, seed });
        const pilots: Autopilot[] = [];
        const opts = drivingEnvOptions(setup, SUV, inputs, autopilotController(pilots));
        const env = new DrivingEnv(opts);
        pilots.push(new Autopilot(opts.city, opts.route, env.world.state, SUV));
        env.reset([IDLE_BRAIN]);
        while (!env.done) env.step();
        const r = env.results()[0];
        expect(r.stopReason).toBe('arrived');
        expect(r.redLightRuns).toBe(0);
        expect(r.safe).toBe(true);
      }
    });
  }
});

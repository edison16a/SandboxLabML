import { describe, expect, it } from 'vitest';
import { Population } from '../neat/population';
import { Network } from '../neat/network';
import { stepCar } from './car/dynamics';
import { DEFAULT_CAR } from './car/params';
import { createRacingCar, updateTrackState } from './car/runtime';
import { builtinRacingController } from './builtinReward';
import { evaluateRacing, recordPath } from './episode';
import { RacingEnv, type RacingEnvOptions } from './env';
import { STANDARD_RACING_INPUTS, type RacingInputConfig } from './sensors/inputConfig';
import { builtInInputCount, racingInputSchema } from './sensors/inputSchema';
import { scriptedDriver } from './scriptedDriver';
import { buildTrack } from './track/buildTrack';
import { BUILT_IN_TRACKS } from './track/presets';

const oval = buildTrack(BUILT_IN_TRACKS[0]);

function options(inputs: RacingInputConfig = STANDARD_RACING_INPUTS): RacingEnvOptions {
  return { track: oval, car: DEFAULT_CAR, inputs, controller: builtinRacingController, maxTime: 60 };
}

describe('scripted driver', () => {
  for (const spec of BUILT_IN_TRACKS) {
    it(`laps ${spec.name} without leaving the road`, () => {
      const track = buildTrack(spec);
      const rc = createRacingCar(0, track, 0);
      const act = new Float64Array(2);
      let maxLateral = 0;
      while (rc.lap < 1 && rc.time < 180) {
        stepCar(rc.car, act[0], act[1], DEFAULT_CAR);
        updateTrackState(rc, track);
        maxLateral = Math.max(maxLateral, Math.abs(rc.pos.lateral));
        scriptedDriver(rc, track, DEFAULT_CAR, act);
      }
      expect(rc.lap).toBe(1);
      expect(maxLateral).toBeLessThan(track.halfWidth);
    });
  }
});

describe('input schema', () => {
  const variants: RacingInputConfig[] = [
    { ...STANDARD_RACING_INPUTS, rays: { count: 1, fov: 0, range: 60 }, headingError: false },
    STANDARD_RACING_INPUTS,
    { ...STANDARD_RACING_INPUTS, steerAngle: true, curvatureNear: true, curvatureFar: true, slip: true },
    { ...STANDARD_RACING_INPUTS, speed: false, headingError: false, rays: { count: 33, fov: Math.PI, range: 40 } },
  ];
  for (const cfg of variants) {
    it(`matches the observation length for ${builtInInputCount(cfg)} inputs`, () => {
      const schema = racingInputSchema(cfg, DEFAULT_CAR);
      const env = new RacingEnv(options(cfg));
      const pop = Population.create({ inputCount: schema.length, outputCount: 2, activation: 'tanh', wiring: 'direct' }, 1, { populationSize: 2 });
      env.reset(pop.genomes.map((g) => new Network(g)));
      env.step();
      expect(env.lastObservation(0).length).toBe(schema.length);
      expect(new Set(schema.map((s) => s.label)).size).toBe(schema.length);
      expect(new Set(schema.map((s) => s.key)).size).toBe(schema.length);
    });
  }
});

describe('replay determinism', () => {
  it('re-simulating one car alone matches its run inside a full generation, tick for tick', () => {
    const pop = Population.create({ inputCount: 11, outputCount: 2, activation: 'tanh', wiring: 'direct' }, 3, { populationSize: 30 });
    const env = new RacingEnv(options());
    env.reset(pop.genomes.map((g) => new Network(g)));
    const target = 17;
    const inGeneration: number[] = [];
    const snap = new Float32Array(30 * 8);
    while (!env.done) {
      const wasDriving = env.cars[target].status === 0;
      env.step();
      env.snapshot(snap);
      if (wasDriving) inGeneration.push(snap[target * 8], snap[target * 8 + 1], snap[target * 8 + 2], snap[target * 8 + 3]);
    }
    const alone = recordPath(pop.genomes[target], options());
    expect(Array.from(alone)).toEqual(inGeneration);
  });
});

describe('headless training', () => {
  it('completes an Oval lap within 50 generations', () => {
    const pop = Population.create({ inputCount: 11, outputCount: 2, activation: 'tanh', wiring: 'direct' }, 7, { populationSize: 100 });
    let lappedAt = -1;
    for (let gen = 0; gen < 50 && lappedAt < 0; gen++) {
      const results = evaluateRacing(pop.genomes, options());
      results.forEach((r, i) => (pop.genomes[i].fitness = r.fitness));
      if (results.some((r) => r.laps >= 1)) lappedAt = gen;
      pop.advance();
    }
    console.log('Oval lapped at generation', lappedAt);
    expect(lappedAt).toBeGreaterThanOrEqual(0);
  });
});

describe('lesion test', () => {
  it('forces the chosen input and changes nothing else', () => {
    const pop = Population.create({ inputCount: 11, outputCount: 2, activation: 'tanh', wiring: 'direct' }, 2, { populationSize: 1 });
    const plain = new RacingEnv(options());
    const lesioned = new RacingEnv({ ...options(), lesion: [[4, 0]] });
    plain.reset([new Network(pop.genomes[0])]);
    lesioned.reset([new Network(pop.genomes[0])]);
    plain.step();
    lesioned.step();
    const a = plain.lastObservation(0);
    const b = lesioned.lastObservation(0);
    expect(b[4]).toBe(0);
    for (let i = 0; i < a.length; i++) if (i !== 4) expect(b[i]).toBe(a[i]);
  });
});

import { describe, expect, it } from 'vitest';
import { findPresetBlueprint } from '../../blueprints/presets';
import type { RacingBlueprint } from '../../blueprints/types';
import { Rng } from '../../core/rng';
import type { AgentController } from '../../env/types';
import { DEFAULT_NEAT } from '../../neat/config';
import { defaultPlan, Population } from '../../neat/population';
import { builtinRacingController } from '../../racing/builtinReward';
import { DEFAULT_CAR } from '../../racing/car/params';
import type { RacingCar } from '../../racing/car/runtime';
import { RacingEnv, type RacingEnvOptions } from '../../racing/env';
import { evaluateRacing } from '../../racing/episode';
import { racingInputSchema, type CustomSensorSpec } from '../../racing/sensors/inputSchema';
import { buildTrack } from '../../racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '../../racing/track/presets';
import { Network } from '../../neat/network';
import { compileScript, type CompiledScript } from '../compiler';
import { findScriptPreset } from '../presets/racing';
import { inTick } from './helpers';

const oval = buildTrack(BUILT_IN_TRACKS[0]);

function compiled(source: string): CompiledScript {
  const r = compileScript(source);
  if (!r.script) throw new Error(r.diagnostics.map((d) => d.message).join('\n'));
  return r.script;
}

function inputsOf(brain: string) {
  return (findPresetBlueprint(brain) as RacingBlueprint).inputs;
}

function options(brain: string, controller: AgentController<RacingCar>, customSensors: CustomSensorSpec[] = []): RacingEnvOptions {
  return { track: oval, car: DEFAULT_CAR, inputs: inputsOf(brain), controller, maxTime: 60, customSensors };
}

function population(brain: string, seed: number, extra = 0) {
  const inputCount = racingInputSchema(inputsOf(brain), DEFAULT_CAR).length + extra;
  return Population.create({ inputCount, outputCount: 2, activation: 'tanh', wiring: 'direct' }, seed, { populationSize: 30 });
}

const GEN = { generation: 0, speciesCount: 6, bestFitness: 10, meanFitness: 2, stagnation: 0 };

describe('Intermediate preset', () => {
  const script = compiled(findScriptPreset('racing-intermediate')!.source);

  it('gives exactly the fitness and stop reasons of the built-in reward, generation after generation', () => {
    const pop = population('racing-standard', 11);
    let laps = 0;
    for (let gen = 0; gen < 12; gen++) {
      const builtin = evaluateRacing(pop.genomes, options('racing-standard', builtinRacingController));
      const scripted = evaluateRacing(pop.genomes, options('racing-standard', script.createController({ seed: gen, track: oval })));
      expect(scripted.map((r) => r.fitness)).toEqual(builtin.map((r) => r.fitness));
      expect(scripted.map((r) => r.stopReason)).toEqual(builtin.map((r) => r.stopReason));
      laps += builtin.reduce((n, r) => n + r.laps, 0);
      builtin.forEach((r, i) => (pop.genomes[i].fitness = r.fitness));
      pop.advance(script.runGeneration({ ...GEN, generation: gen }, new Rng(gen)).plan);
    }
    expect(laps).toBeGreaterThan(0);
  });

  it('gives the same results after its comments change', () => {
    const recommented = compiled(findScriptPreset('racing-intermediate')!.source.replace(/\/\/ .*/g, '// rewritten note'));
    const pop = population('racing-standard', 13);
    const a = evaluateRacing(pop.genomes, options('racing-standard', script.createController({ seed: 1, track: oval })));
    const b = evaluateRacing(pop.genomes, options('racing-standard', recommented.createController({ seed: 1, track: oval })));
    expect(b).toEqual(a);
  });

  it('its generation block asks for exactly the default plan', () => {
    expect(script.runGeneration(GEN, new Rng(1)).plan).toEqual(defaultPlan(DEFAULT_NEAT));
    expect(script.header).toEqual({ name: 'Intermediate: built-in reward', env: 'racing', version: 1, brain: 'racing-standard' });
  });
});

describe('Beginner preset', () => {
  const script = compiled(findScriptPreset('racing-beginner')!.source);

  it('runs a generation and scores one point per checkpoint', () => {
    const pop = population('racing-starter', 3);
    const results = evaluateRacing(pop.genomes, options('racing-starter', script.createController({ seed: 1, track: oval })));
    expect(results).toHaveLength(30);
    for (const r of results) {
      expect(Number.isInteger(r.fitness)).toBe(true);
      expect(['crash', 'stalled', 'time']).toContain(r.stopReason);
    }
  });

  it('keeps the Oval and the default plan', () => {
    const d = script.runGeneration(GEN, new Rng(1));
    expect(d.racing?.track).toEqual({ kind: 'builtin', id: 'oval' });
    expect(d.plan).toEqual(defaultPlan(DEFAULT_NEAT));
  });
});

describe('Advanced preset', () => {
  const script = compiled(findScriptPreset('racing-advanced')!.source);

  it('adds one normalized sensor and runs a generation', () => {
    expect(script.sensors).toEqual([{ key: 'bendFar', label: 'Bend 60 m ahead', unit: '1/m', min: -0.05, max: 0.05 }]);
    const controller = script.createController({ seed: 2, track: oval });
    const opts = options('racing-advanced', controller, script.sensors);
    const pop = population('racing-advanced', 5, 1);
    expect(evaluateRacing(pop.genomes, opts)).toHaveLength(30);
    const env = new RacingEnv(opts);
    env.reset(pop.genomes.slice(0, 1).map((g) => new Network(g)));
    env.step();
    const obs = env.lastObservation(0);
    expect(obs).toHaveLength(16);
    expect(obs[15]).toBeGreaterThanOrEqual(0);
    expect(obs[15]).toBeLessThanOrEqual(1);
  });

  it('switches to a random track every 10 generations and mutates adaptively', () => {
    const at = (generation: number) => script.runGeneration({ ...GEN, generation }, new Rng(generation));
    expect(at(10).racing?.track).toEqual({ kind: 'random', seed: 10 });
    expect(at(20).racing?.track).toEqual({ kind: 'random', seed: 20 });
    expect(at(0).racing).toBeUndefined();
    expect(at(7).racing).toBeUndefined();
    expect(at(3).plan).toMatchObject({ targetSpecies: 10, adaptive: true, mutation: { addConnection: 0.08, addNode: 0.04 } });
  });
});

describe('script sensors and rand', () => {
  it('normalizes a sensor into [0, 1] by its range', () => {
    const script = compiled(inTick('  drive(steer: brain.steer, pedal: 1)', 'sensor sp "Speed" in 0 m/s .. 35 m/s = car.speed'));
    const controller = script.createController({ seed: 1, track: oval });
    const out = new Float64Array(3);
    controller.sensors({ car: { speed: 7 } } as RacingCar, out, 1);
    expect(out[1]).toBeCloseTo(0.2, 12);
    controller.sensors({ car: { speed: 70 } } as RacingCar, out, 1);
    expect(out[1]).toBe(1);
  });

  it('a car replayed alone draws the same random numbers as in its generation', () => {
    const src = inTick('  drive(steer: brain.steer + (rand() - 0.5) / 4, pedal: brain.pedal)\n  reward rand() when checkpoint.passed');
    const script = compiled(src);
    const pop = population('racing-standard', 21);
    const seeds = pop.genomes.map((_, i) => 1000 + i * 7);
    const all = evaluateRacing(pop.genomes, options('racing-standard', script.createController({ seed: 9, track: oval })), seeds);
    for (const k of [4, 17, 29]) {
      const alone = evaluateRacing([pop.genomes[k]], options('racing-standard', script.createController({ seed: 9, track: oval })), [seeds[k]]);
      expect(alone[0]).toEqual(all[k]);
    }
  });

  it('rand in the generation block follows the Rng it is given', () => {
    const src = `script "g" for racing v1\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n}\n\neach generation {\n  select(top: 10% + rand() / 2)\n}\n`;
    const script = compiled(src);
    const a = script.runGeneration(GEN, new Rng(5)).plan.survival;
    expect(script.runGeneration(GEN, new Rng(5)).plan.survival).toBe(a);
    expect(script.runGeneration(GEN, new Rng(6)).plan.survival).not.toBe(a);
  });

  it('runs a stop that fires before later lines, ending the tick there', () => {
    const script = compiled(inTick('  stop "always" when car.time >= 0 s\n  reward 5'));
    const io = { brain: new Float64Array(2), action: new Float64Array(2), reward: 0, stop: null as string | null };
    script.createController({ seed: 0, track: oval }).tick({ time: 0 } as RacingCar, io);
    expect(io).toMatchObject({ stop: 'always', reward: 0 });
  });
});

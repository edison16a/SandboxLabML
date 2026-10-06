import { describe, expect, it } from 'vitest';
import { findPresetBlueprint } from '../../blueprints/presets';
import type { RacingBlueprint } from '../../blueprints/types';
import { Rng } from '../../core/rng';
import { Population } from '../../neat/population';
import { DEFAULT_CAR } from '../../racing/car/params';
import { evaluateRacing } from '../../racing/episode';
import { STANDARD_RACING_INPUTS } from '../../racing/sensors/inputConfig';
import { racingInputSchema } from '../../racing/sensors/inputSchema';
import { buildTrack } from '../../racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '../../racing/track/presets';
import { compileScript } from '../compiler';
import { randomProgram } from './gen/program';

const track = buildTrack(BUILT_IN_TRACKS[2]);

describe('generated programs at run time', () => {
  it('run a short episode and a generation step without throwing', () => {
    for (let i = 0; i < 80; i++) {
      const source = randomProgram(5000 + i);
      const script = compileScript(source).script;
      if (!script) throw new Error(`Program ${i} did not compile:\n${source}`);
      const brain = script.header.brain ? (findPresetBlueprint(script.header.brain) as RacingBlueprint) : null;
      const inputs = brain?.inputs ?? STANDARD_RACING_INPUTS;
      const inputCount = racingInputSchema(inputs, DEFAULT_CAR, script.sensors).length;
      const pop = Population.create({ inputCount, outputCount: 2, activation: 'tanh', wiring: 'direct' }, i, { populationSize: 4 });
      const controller = script.createController({ seed: i, track });
      const results = evaluateRacing(pop.genomes, { track, car: DEFAULT_CAR, inputs, controller, maxTime: 4, customSensors: script.sensors });
      for (const r of results) {
        expect(Number.isFinite(r.fitness), source).toBe(true);
        expect(r.stopReason, source).not.toBeNull();
      }
      const plan = script.runGeneration({ generation: i, speciesCount: 3, bestFitness: 1, meanFitness: 0.5, stagnation: i % 4 }, new Rng(i)).plan;
      expect(plan.survival).toBeGreaterThan(0);
      expect(plan.survival).toBeLessThanOrEqual(1);
      expect(plan.targetSpecies).toBeGreaterThanOrEqual(1);
      expect(plan.crossoverRate).toBeGreaterThanOrEqual(0);
      expect(plan.crossoverRate).toBeLessThanOrEqual(1);
    }
  });
});

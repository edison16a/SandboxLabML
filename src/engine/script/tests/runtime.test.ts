import { describe, expect, it } from 'vitest';
import { findPresetBlueprint } from '../../blueprints/presets';
import type { DrivingLearner } from '../../driving/agent/learner';
import { DEFAULT_DRIVING_BLUEPRINT, type DrivingBlueprint } from '../../driving/blueprints';
import { SUV } from '../../driving/car/params';
import { evaluateDriving } from '../../driving/episode';
import { drivingInputSchema } from '../../driving/sensors/inputSchema';
import { createDrivingSetup, drivingEnvOptions } from '../../driving/setup';
import { Rng } from '../../core/rng';
import { Network } from '../../neat/network';
import { Population } from '../../neat/population';
import { compileScript } from '../compiler';
import { randomProgram } from './gen/program';

/** A short trip on a quiet level, so 80 programs finish quickly but still meet lights and turns. */
const setup = { ...createDrivingSetup({ level: 3, seed: 11 }), maxTime: 4 };

describe('generated programs at run time', () => {
  it('run a short episode and a generation step without throwing', () => {
    for (let i = 0; i < 80; i++) {
      const source = randomProgram(5000 + i);
      const script = compileScript(source).script;
      if (!script) throw new Error(`Program ${i} did not compile:\n${source}`);
      const brain = (script.header.brain ? findPresetBlueprint(script.header.brain) : DEFAULT_DRIVING_BLUEPRINT) as DrivingBlueprint;
      const inputCount = drivingInputSchema(brain.inputs, SUV, script.sensors).length;
      const pop = Population.create({ inputCount, outputCount: 2, activation: 'tanh', wiring: 'direct' }, i, { populationSize: 4 });
      const controller = script.createController<DrivingLearner>({ seed: i });
      const results = evaluateDriving(
        pop.genomes.map((g) => new Network(g)),
        drivingEnvOptions(setup, SUV, brain.inputs, controller, { customSensors: script.sensors }),
      );
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

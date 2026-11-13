import { describe, expect, it } from 'vitest';
import { DEFAULT_DRIVING_BLUEPRINT } from '../../../driving/blueprints';
import { builtinDrivingController } from '../../../driving/builtinReward';
import { SUV } from '../../../driving/car/params';
import type { DrivingLearner } from '../../../driving/agent/learner';
import { evaluateDriving } from '../../../driving/episode';
import { drivingTestBrain } from '../../../driving/run/testBrain';
import { drivingInputSchema } from '../../../driving/sensors/inputSchema';
import { createDrivingSetup, drivingEnvOptions } from '../../../driving/setup';
import { Rng } from '../../../core/rng';
import type { AgentController } from '../../../env/types';
import { neatConfig } from '../../../neat/config';
import { Network } from '../../../neat/network';
import { defaultPlan, Population } from '../../../neat/population';
import { check } from '../../checker';
import { compileScript, type CompiledScript } from '../../compiler';
import { parse } from '../../parser';
import { DRIVING_PRESETS } from '../../presets/driving';
import { REGISTRY } from '../index';
import type { RegistryEntry } from '../types';

const NEAT = neatConfig({ ...DEFAULT_DRIVING_BLUEPRINT.neat, mutation: { ...neatConfig().mutation, ...DEFAULT_DRIVING_BLUEPRINT.neat?.mutation } });
const GEN = { generation: 0, speciesCount: 5, bestFitness: 10, meanFitness: 2, stagnation: 0, metrics: { level: 1 } };

function compiled(source: string): CompiledScript {
  const r = compileScript(source);
  if (!r.script) throw new Error(r.diagnostics.map((d) => d.message).join('\n'));
  return r.script;
}

const preset = (tier: string) => DRIVING_PRESETS.find((p) => p.tier === tier)!.source;

/** The test driver plus a handful of random brains, so trips end every way: arriving, at a red, against a car and stuck. */
function brains() {
  const schema = drivingInputSchema(DEFAULT_DRIVING_BLUEPRINT.inputs, SUV);
  const shape = { inputCount: schema.length, outputCount: 2, activation: 'tanh' as const, wiring: 'direct' as const };
  const random = Population.create(shape, 21, { populationSize: 24 }).genomes;
  return [drivingTestBrain(shape, schema), ...random].map((g) => new Network(g));
}

function drive(level: number, seed: number, controller: AgentController<DrivingLearner>) {
  const setup = createDrivingSetup({ level, seed });
  return evaluateDriving(brains(), drivingEnvOptions(setup, SUV, DEFAULT_DRIVING_BLUEPRINT.inputs, controller));
}

/** Registry entries a preset reads or calls. */
function usedBy(source: string): RegistryEntry[] {
  const checked = check(parse(source).program);
  const used = new Set<RegistryEntry>([...checked.calls.values()].map((c) => c.entry));
  for (const info of checked.exprs.values()) if (info.ref?.kind === 'entry') used.add(info.ref.entry);
  return [...used];
}

describe('the Driving presets', () => {
  it('compile with no errors or warnings and name a Driving brain', () => {
    for (const p of DRIVING_PRESETS) {
      const r = compileScript(p.source);
      expect(r.diagnostics.filter((d) => d.severity !== 'info'), p.id).toEqual([]);
      expect(r.script?.header.env).toBe('driving');
      expect(r.script?.header.brain?.startsWith('driving-')).toBe(true);
    }
  });

  it('Intermediate gives exactly the fitness and stop reasons of the built-in reward', () => {
    const script = compiled(preset('intermediate'));
    for (const [level, seed] of [[2, 4], [3, 9], [4, 12]]) {
      const builtin = drive(level, seed, builtinDrivingController);
      const scripted = drive(level, seed, script.createController({ seed: 1 }));
      expect(scripted.map((r) => r.fitness)).toEqual(builtin.map((r) => r.fitness));
      expect(scripted.map((r) => r.stopReason)).toEqual(builtin.map((r) => r.stopReason));
    }
  });

  it('Beginner charges 2 points for each red light run and changes nothing else', () => {
    const beginner = preset('beginner');
    const cost = '  reward -2 when rules.ranRedLight\n';
    expect(beginner).toContain(cost);
    const free = compiled(beginner.replace(cost, ''));
    let runs = 0;
    for (const [level, seed] of [[2, 4], [2, 7], [2, 11]]) {
      const charged = drive(level, seed, compiled(beginner).createController({ seed: 1 }));
      const uncharged = drive(level, seed, free.createController({ seed: 1 }));
      charged.forEach((r, i) => {
        expect(r.stopReason).toBe(uncharged[i].stopReason);
        expect(r.fitness).toBeCloseTo(uncharged[i].fitness - 2 * r.redLightRuns, 6);
        runs += r.redLightRuns;
      });
    }
    // Some SUVs ran a red, or the test would prove nothing.
    expect(runs).toBeGreaterThan(0);
  });

  it('Intermediate and Beginner ask for exactly the plan a run without a script uses', () => {
    for (const tier of ['beginner', 'intermediate']) expect(compiled(preset(tier)).runGeneration(GEN, new Rng(1), NEAT).plan).toEqual(defaultPlan(NEAT));
  });

  it('Advanced mixes in random cities only once the lights are learned', () => {
    const script = compiled(preset('advanced'));
    const at = (generation: number, level: number) => script.runGeneration({ ...GEN, generation, metrics: { level } }, new Rng(1), NEAT).env;
    expect(at(5, 2) ?? {}).toEqual({});
    expect(at(5, 3)).toEqual({ city: 'random-5' });
    expect(at(6, 3)).toEqual({ city: 'midtown' });
  });

  it('driving entries list exactly the tiers whose preset uses them', () => {
    for (const p of DRIVING_PRESETS) {
      const used = usedBy(p.source).filter((e) => e.env === 'driving').map((e) => e.name);
      const tagged = REGISTRY.filter((e) => e.env === 'driving' && e.presets.includes(p.tier)).map((e) => e.name);
      expect(used.sort(), p.id).toEqual(tagged.sort());
    }
  });
});

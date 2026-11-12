import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import type { DrivingLearner } from '../../driving/agent/learner';
import { DEFAULT_NEAT } from '../../neat/config';
import { defaultPlan, Population } from '../../neat/population';
import type { NavAgent } from '../../navigation/agent';
import { buildCourse } from '../../navigation/course/build';
import { generateCourse } from '../../navigation/course/generate';
import { evaluateNavigation } from '../../navigation/episode';
import { DEFAULT_NAVIGATION_PARAMS } from '../../navigation/params';
import { NAVIGATION_BLUEPRINTS } from '../../navigation/pipeline/blueprints';
import { navigationInputSchema } from '../../navigation/sensors/inputSchema';
import { compileScript, type CompiledScript } from '../compiler';
import { findScriptPreset } from '../presets';
import { inTick, NAVIGATION_ACT } from './helpers';

function compiled(source: string): CompiledScript {
  const r = compileScript(source);
  if (!r.script) throw new Error(r.diagnostics.map((d) => d.message).join('\n'));
  return r.script;
}

const GEN = { generation: 0, speciesCount: 6, bestFitness: 10, meanFitness: 2, stagnation: 0 };
const params = DEFAULT_NAVIGATION_PARAMS;
/** A course with spikes and blocks, so runners finish, die and run out of time. */
const course = buildCourse(generateCourse(3, 41), params);
const inputs = NAVIGATION_BLUEPRINTS[1].inputs;

/** Navigation runners under a compiled script, every one on its own seed. */
function run(script: CompiledScript, seed: number, genomes = population(seed).genomes, seeds?: number[]) {
  const controller = script.createController<NavAgent>({ seed, extra: { level: course.spec.level, course } });
  return evaluateNavigation(genomes, { course, params, inputs, controller, customSensors: script.sensors }, seeds);
}

function population(seed: number, extra = 0) {
  const inputCount = navigationInputSchema(inputs).length + extra;
  return Population.create({ inputCount, outputCount: 2, activation: 'tanh', wiring: 'direct' }, seed, { populationSize: 30 });
}

describe('presets', () => {
  it('give the same results after their comments change', () => {
    const source = findScriptPreset('navigation-intermediate')!.source;
    const recommented = compiled(source.replace(/\/\/ .*/g, '// rewritten note'));
    const pop = population(13);
    expect(run(recommented, 1, pop.genomes)).toEqual(run(compiled(source), 1, pop.genomes));
  });

  it('read their header', () => {
    const script = compiled(findScriptPreset('driving-intermediate')!.source);
    expect(script.header).toEqual({ name: 'Intermediate: built-in reward', env: 'driving', version: 1, brain: 'driving-standard' });
  });

  it('a script with no generation block asks for exactly the default plan', () => {
    const script = compiled(inTick('  drive(steer: brain.steer, pedal: brain.pedal)\n  reward +0.02 * route.gain'));
    expect(script.runGeneration(GEN, new Rng(1)).plan).toEqual(defaultPlan(DEFAULT_NEAT));
    expect(script.runGeneration(GEN, new Rng(1)).env).toBeUndefined();
  });
});

describe('script sensors and rand', () => {
  it('normalizes a sensor into [0, 1] by its range', () => {
    const script = compiled(inTick('  drive(steer: brain.steer, pedal: 1)', 'sensor sp "Speed" in 0 m/s .. 24 m/s = car.speed'));
    const controller = script.createController<DrivingLearner>({ seed: 1 });
    const out = new Float64Array(3);
    controller.sensors({ car: { speed: 6 } } as DrivingLearner, out, 1);
    expect(out[1]).toBeCloseTo(0.25, 12);
    controller.sensors({ car: { speed: 70 } } as DrivingLearner, out, 1);
    expect(out[1]).toBe(1);
  });

  it('a runner replayed alone draws the same random numbers as in its generation', () => {
    const act = NAVIGATION_ACT.replace('brain.move', 'brain.move + (rand() - 0.5) / 4');
    const script = compiled(`script "r" for navigation v1\nbrain navigation-standard\n\neach tick {\n  ${act}\n  reward rand() * agent.progressGain\n}\n`);
    const pop = population(21);
    const seeds = pop.genomes.map((_, i) => 1000 + i * 7);
    const all = run(script, 9, pop.genomes, seeds);
    for (const k of [4, 17, 29]) {
      const alone = run(script, 9, [pop.genomes[k]], [seeds[k]]);
      expect(alone[0]).toEqual(all[k]);
    }
  });

  it('rand in the generation block follows the Rng it is given', () => {
    const src = `script "g" for driving v1\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n}\n\neach generation {\n  select(top: 10% + rand() / 2)\n}\n`;
    const script = compiled(src);
    const a = script.runGeneration(GEN, new Rng(5)).plan.survival;
    expect(script.runGeneration(GEN, new Rng(5)).plan.survival).toBe(a);
    expect(script.runGeneration(GEN, new Rng(6)).plan.survival).not.toBe(a);
  });

  it('runs a stop that fires before later lines, ending the tick there', () => {
    const script = compiled(inTick('  stop "always" when car.time >= 0 s\n  reward 5'));
    const io = { brain: new Float64Array(2), action: new Float64Array(2), reward: 0, stop: null as string | null };
    script.createController<DrivingLearner>({ seed: 0 }).tick({ time: 0 } as DrivingLearner, io);
    expect(io).toMatchObject({ stop: 'always', reward: 0 });
  });
});

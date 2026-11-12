import { describe, expect, it } from 'vitest';
import type { AgentController } from '../../env/types';
import { Population } from '../../neat/population';
import type { NavAgent } from '../../navigation/agent';
import { builtinNavigationController } from '../../navigation/builtinReward';
import { buildCourse } from '../../navigation/course/build';
import { generateCourse } from '../../navigation/course/generate';
import { evaluateNavigation } from '../../navigation/episode';
import { DEFAULT_NAVIGATION_PARAMS } from '../../navigation/params';
import { NAVIGATION_BLUEPRINTS } from '../../navigation/pipeline/blueprints';
import { navigationInputSchema } from '../../navigation/sensors/inputSchema';
import { compileScript } from '../compiler';
import { costToMicros } from '../cost';
import { findScriptPreset } from '../presets';

const params = DEFAULT_NAVIGATION_PARAMS;
const course = buildCourse(generateCourse(3, 7), params);
const inputs = NAVIGATION_BLUEPRINTS[1].inputs;
const options = (controller: AgentController<NavAgent>) => ({ course, params, inputs, controller });

// Navigation ticks are cheap, so the script's own cost is a large share of each one: a fair place to time it.
describe('turbo speed', () => {
  it('the Intermediate preset runs at least 80% as fast as the built-in reward', () => {
    const script = compileScript(findScriptPreset('navigation-intermediate')!.source).script!;
    // Evolve a little first, so runners live long enough for the reward to matter.
    const pop = Population.create({ inputCount: navigationInputSchema(inputs).length, outputCount: 2, activation: 'tanh', wiring: 'direct' }, 5, { populationSize: 60 });
    for (let gen = 0; gen < 6; gen++) {
      evaluateNavigation(pop.genomes, options(builtinNavigationController)).forEach((r, i) => (pop.genomes[i].fitness = r.fitness));
      pop.advance();
    }
    const time = (make: () => AgentController<NavAgent>) => {
      const t0 = performance.now();
      for (let i = 0; i < 3; i++) evaluateNavigation(pop.genomes, options(make()));
      return performance.now() - t0;
    };
    let builtin = Infinity;
    let scripted = Infinity;
    // Alternate the two and keep the best of each, so JIT warmup and GC pauses do not pick a winner.
    for (let round = 0; round < 5; round++) {
      builtin = Math.min(builtin, time(() => builtinNavigationController));
      scripted = Math.min(scripted, time(() => script.createController<NavAgent>({ seed: 1, extra: { level: course.spec.level, course } })));
    }
    const ratio = builtin / scripted;
    console.log(`script speed: ${(ratio * 100).toFixed(0)}% of built-in (${builtin.toFixed(0)} ms vs ${scripted.toFixed(0)} ms), estimated ${costToMicros(script.costEstimate).toFixed(2)} µs per tick`);
    expect(ratio).toBeGreaterThanOrEqual(0.8);
  });
});

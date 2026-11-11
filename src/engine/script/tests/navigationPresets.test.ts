import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { builtinNavigationController } from '../../navigation/builtinReward';
import { buildCourse } from '../../navigation/course/build';
import { generateCourse } from '../../navigation/course/generate';
import { evaluateNavigation } from '../../navigation/episode';
import { NAVIGATION_BLUEPRINTS } from '../../navigation/pipeline/blueprints';
import { DEFAULT_NAVIGATION_PARAMS } from '../../navigation/params';
import { navigationInputSchema } from '../../navigation/sensors/inputSchema';
import { Population } from '../../neat/population';
import { check } from '../checker';
import { compileScript, type CompiledScript } from '../compiler';
import { parse } from '../parser';
import { NAVIGATION_PRESETS } from '../presets/navigation';
import { REGISTRY, type RegistryEntry } from '../registry';

function compiled(source: string): CompiledScript {
  const r = compileScript(source);
  if (!r.script) throw new Error(r.diagnostics.map((d) => d.message).join('\n'));
  return r.script;
}

/** Registry entries a preset reads or calls. */
function usedBy(source: string): RegistryEntry[] {
  const checked = check(parse(source).program);
  const used = new Set<RegistryEntry>([...checked.calls.values()].map((c) => c.entry));
  for (const info of checked.exprs.values()) if (info.ref?.kind === 'entry') used.add(info.ref.entry);
  return [...used];
}

const GEN = { generation: 0, speciesCount: 6, bestFitness: 10, meanFitness: 2, stagnation: 0 };
const params = DEFAULT_NAVIGATION_PARAMS;

describe('Navigation presets', () => {
  it('compile without a warning, one per tier, each naming a Navigation brain', () => {
    expect(NAVIGATION_PRESETS.map((p) => p.tier)).toEqual(['beginner', 'intermediate', 'advanced']);
    for (const p of NAVIGATION_PRESETS) {
      const r = compileScript(p.source);
      expect(r.diagnostics, p.id).toEqual([]);
      expect(NAVIGATION_BLUEPRINTS.map((b) => b.id)).toContain(r.script?.header.brain);
    }
  });

  // Core entries are shared, and their tags describe the racing presets, so only Navigation entries are compared.
  it('navigation entries list exactly the tiers whose preset uses them', () => {
    for (const preset of NAVIGATION_PRESETS) {
      const used = usedBy(preset.source).filter((e) => e.env === 'navigation').map((e) => e.name);
      const tagged = REGISTRY.filter((e) => e.env === 'navigation' && e.presets.includes(preset.tier)).map((e) => e.name);
      expect(used.sort(), preset.id).toEqual(tagged.sort());
    }
  });

  it('Intermediate gives exactly the fitness and stop reasons of the built-in reward', () => {
    const script = compiled(NAVIGATION_PRESETS[1].source);
    const inputs = NAVIGATION_BLUEPRINTS[1].inputs;
    const pop = Population.create({ inputCount: navigationInputSchema(inputs).length, outputCount: 2, activation: 'tanh', wiring: 'direct' }, 17, { populationSize: 30 });
    let finished = 0;
    let died = 0;
    for (let gen = 0; gen < 8; gen++) {
      // Levels with spikes and movers come early, so deaths and finishes both get compared.
      const course = buildCourse(generateCourse([1, 3, 5, 6][gen % 4], 40 + gen), params);
      const opts = { course, params, inputs };
      const builtin = evaluateNavigation(pop.genomes, { ...opts, controller: builtinNavigationController });
      const scripted = evaluateNavigation(pop.genomes, { ...opts, controller: script.createController({ seed: gen, extra: { level: course.spec.level, course } }) });
      expect(scripted.map((r) => r.fitness)).toEqual(builtin.map((r) => r.fitness));
      expect(scripted.map((r) => r.stopReason)).toEqual(builtin.map((r) => r.stopReason));
      finished += builtin.filter((r) => r.finished).length;
      died += builtin.filter((r) => r.died).length;
      builtin.forEach((r, i) => (pop.genomes[i].fitness = r.fitness));
      pop.advance(script.runGeneration({ ...GEN, generation: gen }, new Rng(gen)).plan);
    }
    expect(died).toBeGreaterThan(0);
    expect(finished + died).toBeGreaterThan(0);
  });

  it('Advanced asks for three courses once the spikes start, and leaves the level to the curriculum', () => {
    const script = compiled(NAVIGATION_PRESETS[2].source);
    const at = (level: number) => script.runGeneration({ ...GEN, metrics: { level } }, new Rng(1)).env ?? {};
    expect(at(2)).toEqual({});
    expect(at(3)).toEqual({ courses: 3 });
  });
});

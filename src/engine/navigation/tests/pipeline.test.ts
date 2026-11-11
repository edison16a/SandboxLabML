import { describe, expect, it } from 'vitest';
import { mixSeed } from '../../core/rng';
import { loadEpisodeModule, requireEpisodeInfo } from '../../env/registry';
import { Network } from '../../neat/network';
import { EpisodeTrainer, trainingControllerSeed } from '../../training/episodeTrainer';
import { createEpisodeRunConfig } from '../../training/newRun';
import { builtinHost } from '../../training/scriptHost';
import { navigationModule } from '../module';
import { NAVIGATION_BLUEPRINTS } from '../pipeline/blueprints';
import { NAV_DIRECTIVE, nextNavigationContent, RANDOM_COURSE, type NavigationContent } from '../pipeline/content';
import type { NavigationRunResult } from '../pipeline/runResult';
import { navigationSettings } from '../pipeline/settings';
import { NAVIGATION_SNAPSHOT } from '../snapshot';

function run(populationSize = 24, settings = navigationSettings()) {
  return createEpisodeRunConfig({ env: 'navigation', name: 't', seed: 5, blueprint: NAVIGATION_BLUEPRINTS[1], populationSize, settings: { ...settings } });
}

/** Runs one generation the way the coordinator does: the population in `parts` slices, seeds and slots sliced alike. */
function evaluate(t: EpisodeTrainer, parts: number): NavigationRunResult[] {
  const setup = t.setup();
  const seeds = t.seeds();
  const slots = t.slots();
  const chunk = Math.ceil(t.genomes.length / parts);
  const out: NavigationRunResult[] = [];
  for (let p = 0; p < parts; p++) {
    const genomes = t.genomes.slice(p * chunk, (p + 1) * chunk);
    if (!genomes.length) continue;
    const env = navigationModule.createEnv(setup, builtinHost, trainingControllerSeed(t.generation));
    env.reset(
      genomes.map((g) => new Network(g)),
      seeds.slice(p * chunk, (p + 1) * chunk),
      slots?.slice(p * chunk, (p + 1) * chunk),
    );
    while (!env.done) env.step();
    out.push(...env.results());
  }
  return out;
}

const result = (fitness: number, finished: number, courses = 2): NavigationRunResult => ({ fitness, finished, courses, died: 0, progress: 1, finishTime: 9, time: 9, stopReason: 'finished', endX: 0, endZ: 0 });

describe('navigation in the generic pipeline', () => {
  it('is registered, and its light half matches the module', async () => {
    expect(requireEpisodeInfo('navigation').label).toBe('Navigation');
    const loaded = await loadEpisodeModule('navigation');
    expect(loaded.snapshot).toBe(NAVIGATION_SNAPSHOT);
    expect(loaded.inputSchema(run()).length).toBe(42);
  });

  it('gives the same results whole or split across workers, and every agent its own spot', () => {
    const t = new EpisodeTrainer(navigationModule, run());
    const slots = t.slots()!;
    expect(new Set(slots).size).toBe(slots.length);
    expect(evaluate(t, 3)).toEqual(evaluate(t, 1));
  });

  it('replays a champion alone, from its seed and slot, on the content its record kept', () => {
    const t = new EpisodeTrainer(navigationModule, run());
    const results = evaluate(t, 2);
    const record = t.complete(results, 1);
    expect(record.content).toBeDefined();
    expect(record.replaySlot).toBeTypeOf('number');
    const setup = navigationModule.createSetup({ config: t.config, content: record.content as NavigationContent, scriptSource: null });
    const env = navigationModule.createEnv(setup, builtinHost, trainingControllerSeed(record.generation));
    env.reset([new Network(record.genome)], [record.replaySeed], [record.replaySlot!]);
    while (!env.done) env.step();
    expect(env.results()[0].fitness).toBeCloseTo(record.champion.fitness, 9);
  });

  it('runs two courses per generation by default and fresh ones each generation', () => {
    const t = new EpisodeTrainer(navigationModule, run(12));
    const first = t.setup().courses.map((c) => c.id);
    t.complete(evaluate(t, 1), 1);
    const second = t.setup().courses.map((c) => c.id);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(second).not.toEqual(first);
  });

  it('climbs once the best fifth keeps finishing, and follows a script', () => {
    const config = run();
    let content = navigationModule.initialContent(config) as NavigationContent;
    const plan = { plan: { selection: { mode: 'tournament' } } } as never;
    const good = Array.from({ length: 10 }, (_, i) => result(20 - i, 2));
    for (let g = 0; g < 3; g++) content = nextNavigationContent({ config, content, generation: g, directives: plan, results: good, metrics: {} }).content;
    expect(content.curriculum.level).toBe(1);
    expect(content.generation).toBe(3);
    const asked = (env: Record<string, unknown>) => ({ ...(plan as object), env }) as never;
    const pinned = nextNavigationContent({ config, content, generation: 3, directives: asked({ [NAV_DIRECTIVE.level]: 4, [NAV_DIRECTIVE.courses]: 9 }), results: good, metrics: {} });
    expect(pinned.reset).toBe(true);
    expect(pinned.content.curriculum.level).toBe(4);
    expect(pinned.content.courses).toBe(4);
    const named = nextNavigationContent({ config, content: pinned.content, generation: 4, directives: asked({ [NAV_DIRECTIVE.course]: 'zigzag' }), results: good, metrics: {} }).content;
    expect(named.course).toBe('zigzag');
    expect(navigationModule.createSetup({ config, content: named, scriptSource: null }).courses.map((c) => c.id)).toEqual(['zigzag']);
    expect(nextNavigationContent({ config, content: named, generation: 5, directives: asked({ [NAV_DIRECTIVE.course]: RANDOM_COURSE }), results: good, metrics: {} }).content.course).toBeNull();
  });

  it('stays put on a fixed level until a script asks with autoLevel', () => {
    const config = run(24, navigationSettings({ autoLevel: false, startLevel: 2 }));
    let content = navigationModule.initialContent(config) as NavigationContent;
    const good = Array.from({ length: 10 }, () => result(5, 2));
    const plain = { plan: {} } as never;
    for (let g = 0; g < 5; g++) content = nextNavigationContent({ config, content, generation: g, directives: plain, results: good, metrics: {} }).content;
    expect(content.curriculum.level).toBe(2);
    const auto = { plan: {}, env: { [NAV_DIRECTIVE.autoLevel]: 0.5 } } as never;
    for (let g = 5; g < 8; g++) content = nextNavigationContent({ config, content, generation: g, directives: auto, results: good, metrics: {} }).content;
    expect(content.curriculum.level).toBe(3);
  });

  it('seeds the start slots by run and generation', () => {
    const t = new EpisodeTrainer(navigationModule, run(30));
    expect(t.slots()).toEqual(navigationModule.startSlots!(30, mixSeed(5, 0, 0x51a7)));
  });
});

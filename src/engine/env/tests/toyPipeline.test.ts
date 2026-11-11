import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { blueprintShape } from '../../blueprints/shape';
import { Network } from '../../neat/network';
import { EpisodeTrainer, trainingControllerSeed } from '../../training/episodeTrainer';
import { createEpisodeRunConfig } from '../../training/newRun';
import { builtinHost } from '../../training/scriptHost';
import { metricValue } from '../metrics';
import { engineVersionOf, episodeInfo, isKnownEnv, registerEpisodeModule } from '../registry';
import { TOY_BLUEPRINT, TOY_ENV, toyModule } from './toyEnv';

let unregister: () => void;
beforeAll(() => {
  unregister = registerEpisodeModule(toyModule);
});
afterAll(() => unregister());

function config(seed = 3) {
  return createEpisodeRunConfig({ env: TOY_ENV, name: 'toy', seed, blueprint: TOY_BLUEPRINT, populationSize: 24, settings: { maxTime: 6 } });
}

/** One generation the way the sim workers run it, without the threads. */
function generation(t: EpisodeTrainer) {
  const env = toyModule.createEnv(t.setup() as never, t.host(), trainingControllerSeed(t.generation));
  env.reset(
    t.genomes.map((g) => new Network(g)),
    t.seeds(),
  );
  while (!env.done) env.step();
  return t.complete(env.results() as never, 0);
}

describe('a toy env through the generic pipeline', () => {
  it('registers, and the registry answers for it', () => {
    expect(episodeInfo(TOY_ENV)).toBe(toyModule);
    expect(isKnownEnv(TOY_ENV)).toBe(true);
    expect(engineVersionOf(TOY_ENV)).toBe(7);
  });

  it('builds a run config from the module', () => {
    const c = config();
    expect(c.engineVersion).toBe(7);
    expect(c.settings).toEqual({ maxTime: 6 });
    expect(c.physicsHash).toBe(toyModule.physicsHash(c));
    expect(blueprintShape(c.blueprint)).toMatchObject({ inputCount: 2, outputCount: 1 });
  });

  it('trains with champion and generation metrics and moves the curriculum on', () => {
    const t = new EpisodeTrainer(toyModule, config());
    const records = Array.from({ length: 12 }, () => generation(t));
    const [reached, best] = toyModule.metrics;
    expect(records.every((r) => Number.isFinite(metricValue(r, reached)) && Number.isFinite(metricValue(r, best)))).toBe(true);
    expect(records[0].champion.metrics?.best).toBeCloseTo(records[0].champion.fitness, 9);
    expect(records[0].trackHash).toBe('level-1');
    // Walking 10 m in 6 s is easy, so the population soon levels up and the hash follows the content.
    expect(t.content.level).toBeGreaterThan(1);
    expect(new Set(records.map((r) => r.trackHash)).size).toBeGreaterThan(1);
  });

  it('repeats exactly, and resumes from a checkpoint with identical results', () => {
    const a = new EpisodeTrainer(toyModule, config(9));
    const b = new EpisodeTrainer(toyModule, a.config);
    for (let i = 0; i < 4; i++) expect(generation(b)).toEqual(generation(a));
    const c = new EpisodeTrainer(toyModule, a.config, structuredClone(a.toState()));
    for (let i = 0; i < 3; i++) expect(generation(c).stats).toEqual(generation(a).stats);
  });

  it('falls back to the env when the run has no script', () => {
    expect(builtinHost.createController({ seed: 1 })).toBeNull();
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '../../env/registry';
import { toyModule } from '../../env/tests/toyEnv';
import { toyConfig } from '../../env/tests/toyRun';
import { NAVIGATION_BLUEPRINTS } from '../../navigation/pipeline/blueprints';
import { navigationSettings } from '../../navigation/pipeline/settings';
import { Population } from '../../neat/population';
import { createEpisodeRunConfig } from '../../training/newRun';
import { runShape } from '../../training/runConfig';
import { runBenchmark } from '../index';
import '../../script/compiler';

const config = createEpisodeRunConfig({ env: 'navigation', name: 'bench', seed: 3, blueprint: NAVIGATION_BLUEPRINTS[1], populationSize: 10, settings: { ...navigationSettings() } });
const brain = Population.create(runShape(config), 2, { populationSize: 1 }).genomes[0];

/** What runBenchmark promises for every env, whichever exam its module brings. */
describe('runBenchmark', () => {
  it('reports progress up to 1, then the result for the run env', async () => {
    const seen: number[] = [];
    const result = await runBenchmark(config, brain, { onProgress: (f) => seen.push(f) });
    expect(result?.env).toBe('navigation');
    expect(seen.length).toBeGreaterThan(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen.at(-1)).toBe(1);
  });

  it('stops when aborted, with no result', async () => {
    const controller = new AbortController();
    expect(await runBenchmark(config, brain, { signal: controller.signal, onProgress: () => controller.abort() })).toBeNull();
  });

  describe('for an env without a benchmark', () => {
    let unregister: () => void;
    beforeAll(() => {
      unregister = registerEpisodeModule({ ...toyModule, bench: undefined });
    });
    afterAll(() => unregister());

    it('returns null', async () => {
      const toy = toyConfig();
      expect(await runBenchmark(toy, Population.create(runShape(toy), 1, { populationSize: 1 }).genomes[0])).toBeNull();
    });
  });
});

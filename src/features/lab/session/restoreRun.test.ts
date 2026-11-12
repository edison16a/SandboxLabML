import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '@/engine/env/registry';
import { toyModule } from '@/engine/env/tests/toyEnv';
import { toyConfig, toyGeneration, toyTrainer } from '@/engine/env/tests/toyRun';
import { saveCheckpoint } from '@/storage/checkpoints';
import { SandboxDb, setDb } from '@/storage/db';
import { saveGeneration } from '@/storage/generations';
import { runBest } from '@/storage/runBest';
import { createRun, getRun } from '@/storage/runs';
import { restoreHistory } from './restoreRun';

let unregister: () => void;
beforeAll(() => {
  unregister = registerEpisodeModule(toyModule);
});
afterAll(() => unregister());

let n = 0;
beforeEach(() => setDb(new SandboxDb(`restore-${n++}`)));

describe('restoreHistory', () => {
  it('counts only the generations a resume keeps on the run summary', async () => {
    const config = toyConfig(4);
    await createRun(config);
    const t = toyTrainer(config);
    for (let i = 0; i < 10; i++) {
      if (i === 6) await saveCheckpoint(config.id, t.generation, t.toState());
      await saveGeneration(toyGeneration(t));
    }
    expect((await getRun(config.id))?.generation).toBe(10);
    // The newest checkpoint is at 6, so generations 6 to 9 go and training brings them back.
    const { history, state } = await restoreHistory(config.id);
    expect(history.map((r) => r.generation)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(state?.population.generation).toBe(6);
    const row = (await getRun(config.id))!;
    expect(row.generation).toBe(6);
    expect(row.bestFitness).toBe(Math.max(0, ...history.map((r) => r.champion.fitness)));
    const [, best] = toyModule.metrics;
    expect(runBest(row, best)).toBe(Math.max(...history.map((r) => r.champion.metrics!.best)));
  });

  it('leaves the summary alone when the history reaches the checkpoint', async () => {
    const config = toyConfig(4);
    await createRun(config);
    const t = toyTrainer(config);
    for (let i = 0; i < 4; i++) await saveGeneration(toyGeneration(t));
    await saveCheckpoint(config.id, t.generation, t.toState());
    const before = await getRun(config.id);
    const { history } = await restoreHistory(config.id);
    expect(history).toHaveLength(4);
    expect(await getRun(config.id)).toEqual(before);
  });
});

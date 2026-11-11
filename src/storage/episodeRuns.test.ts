import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '@/engine/env/registry';
import { toyModule } from '@/engine/env/tests/toyEnv';
import { toyConfig, toyGeneration, toyTrainer } from '@/engine/env/tests/toyRun';
import { latestCheckpoint } from './checkpoints';
import { SandboxDb, setDb } from './db';
import { loadHistory, saveGeneration } from './generations';
import { branchRun } from './runActions';
import { createRun } from './runs';

let unregister: () => void;
beforeAll(() => {
  unregister = registerEpisodeModule(toyModule);
});
afterAll(() => unregister());

let n = 0;
beforeEach(() => setDb(new SandboxDb(`episode-${n++}`)));

/** A stored toy run of `generations` generations. */
async function storedRun(generations: number) {
  const config = toyConfig(4);
  await createRun(config);
  const t = toyTrainer(config);
  for (let i = 0; i < generations; i++) await saveGeneration(toyGeneration(t));
  return config;
}

describe('runs of a registry env', () => {
  it('keep the content each generation ran on, and a branch resumes on it', async () => {
    const config = await storedRun(10);
    const history = await loadHistory(config.id);
    const levels = history.map((r) => (r.content as { level: number }).level);
    // The hash names the content the record kept, generation by generation.
    expect(history.map((r) => r.trackHash)).toEqual(levels.map((l) => `level-${l}`));
    const later = history.find((r) => (r.content as { level: number }).level > 1);
    expect(later).toBeDefined();
    const branch = await branchRun(config.id, later!.generation);
    const cp = await latestCheckpoint(branch.id);
    expect((cp?.state as { content: unknown }).content).toEqual(later!.content);
  });
});

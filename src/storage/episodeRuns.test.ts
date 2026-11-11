import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '@/engine/env/registry';
import { TOY_BLUEPRINT, toyModule } from '@/engine/env/tests/toyEnv';
import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import type { Blueprint } from '@/engine/blueprints/types';
import { EpisodeTrainer, type EpisodeTrainerState } from '@/engine/training/episodeTrainer';
import { toyConfig, toyGeneration, toyTrainer } from '@/engine/env/tests/toyRun';
import { latestCheckpoint, saveCheckpoint } from './checkpoints';
import { forkRun } from './forkRun';
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

  it('grow a brain onto a blueprint with more sensors and keep training', async () => {
    const config = toyConfig(6);
    await createRun(config);
    const t = toyTrainer(config);
    for (let i = 0; i < 3; i++) await saveGeneration(toyGeneration(t));
    await saveCheckpoint(config.id, t.generation, t.toState());
    const bigger = { ...TOY_BLUEPRINT, id: 'toy-paced', inputs: { noise: 0, pace: true } } as Blueprint;
    const grown = await forkRun(config.id, bigger);
    expect(grown.physicsHash).not.toBe(config.physicsHash);
    expect(grown.parent).toEqual({ runId: config.id, generation: 3 });
    const state = (await latestCheckpoint(grown.id))?.state as EpisodeTrainerState;
    expect(state.population.template.shape.inputCount).toBe(3);
    expect(state.population.genomes.every((g) => g.inputs.length === 3)).toBe(true);
    // The grown run resumes on the new inputs and its brains read all three.
    const resumed = new EpisodeTrainer(toyModule, grown, state);
    expect(toyGeneration(resumed).generation).toBe(3);
    await expect(forkRun(config.id, RACING_BLUEPRINTS[0])).rejects.toThrow('not a toy one');
  });
});

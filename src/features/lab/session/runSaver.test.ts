import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerEpisodeModule } from '@/engine/env/registry';
import { toyConfig, toyGeneration, toyTrainer } from '@/engine/env/tests/toyRun';
import * as checkpoints from '@/storage/checkpoints';
import { listCheckpoints } from '@/storage/checkpoints';
import { SandboxDb, setDb } from '@/storage/db';
import * as generations from '@/storage/generations';
import { loadHistory } from '@/storage/generations';
import { onRunsRemoved } from '@/storage/runEvents';
import { createRun, destroyRun, getRun, trashRun } from '@/storage/runs';
import { toyModule } from '@/engine/env/tests/toyEnv';
import { RunSaver, SAVE_BACKLOG } from './runSaver';

let unregister: () => void;
beforeAll(() => {
  unregister = registerEpisodeModule(toyModule);
});
afterAll(() => unregister());

let n = 0;
beforeEach(() => {
  setDb(new SandboxDb(`saver-${n++}`));
  vi.restoreAllMocks();
});

/** A stored toy run and a trainer that makes its generations. */
async function toyRun() {
  const config = toyConfig(3);
  await createRun(config);
  return { config, trainer: toyTrainer(config) };
}

describe('RunSaver', () => {
  it('writes a backlog of generations in one go and keeps the run summary right', async () => {
    const { config, trainer } = await toyRun();
    const batches: number[] = [];
    const save = generations.saveGenerations;
    vi.spyOn(generations, 'saveGenerations').mockImplementation(async (records) => {
      batches.push(records.length);
      await save(records);
    });
    const saver = new RunSaver();
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 30; i++) writes.push(saver.generation(toyGeneration(trainer)));
    expect(saver.backlog).toBe(30);
    expect(saver.backlog).toBeGreaterThanOrEqual(SAVE_BACKLOG);
    await Promise.all(writes);
    // The first write starts with whatever had arrived by then; everything after it waits for one more.
    expect(batches.length).toBeLessThanOrEqual(2);
    expect(batches.reduce((a, b) => a + b, 0)).toBe(30);
    expect(saver.backlog).toBe(0);
    expect((await loadHistory(config.id)).map((r) => r.generation)).toEqual([...Array(30).keys()]);
    expect((await getRun(config.id))?.generation).toBe(30);
  });

  it('drops a waiting checkpoint for a newer one and writes it after the generations it follows', async () => {
    const { config, trainer } = await toyRun();
    const order: string[] = [];
    // Hold the first write open, so everything after it piles up behind it.
    let open = () => {};
    const gate = new Promise<void>((resolve) => (open = resolve));
    const saveGenerations = generations.saveGenerations;
    const saveCheckpoint = checkpoints.saveCheckpoint;
    vi.spyOn(generations, 'saveGenerations').mockImplementation(async (records) => {
      order.push(`generations ${records.length}`);
      if (order.length === 1) await gate;
      await saveGenerations(records);
    });
    vi.spyOn(checkpoints, 'saveCheckpoint').mockImplementation(async (runId, generation, state) => {
      order.push(`checkpoint ${generation}`);
      await saveCheckpoint(runId, generation, state);
    });
    const saver = new RunSaver();
    const first = saver.generation(toyGeneration(trainer));
    await vi.waitFor(() => expect(order).toEqual(['generations 1']));
    for (let i = 1; i < 25; i++) {
      void saver.generation(toyGeneration(trainer));
      if (i % 10 === 0) void saver.checkpoint(config.id, i, trainer.toState());
    }
    expect(saver.backlog).toBe(25);
    open();
    await first;
    await saver.checkpoint(config.id, 25, trainer.toState());
    expect(order).toEqual(['generations 1', 'generations 24', 'checkpoint 25']);
    expect((await listCheckpoints(config.id)).map((c) => c.generation)).toEqual([25]);
  });

  it('leaves nothing behind for a run deleted while its backlog waits', async () => {
    const { config, trainer } = await toyRun();
    let open = () => {};
    const gate = new Promise<void>((resolve) => (open = resolve));
    const save = generations.saveGenerations;
    let calls = 0;
    vi.spyOn(generations, 'saveGenerations').mockImplementation(async (records) => {
      if (calls++ === 0) await gate;
      await save(records);
    });
    const saver = new RunSaver();
    const first = saver.generation(toyGeneration(trainer));
    for (let i = 1; i < 12; i++) void saver.generation(toyGeneration(trainer));
    const last = saver.checkpoint(config.id, 12, trainer.toState());
    const heard: unknown[] = [];
    const stop = onRunsRemoved((removed) => heard.push(removed));
    await destroyRun(config.id);
    stop();
    open();
    await first;
    await last;
    expect(heard).toEqual([[config.id]]);
    expect(await getRun(config.id)).toBeUndefined();
    expect(await loadHistory(config.id)).toEqual([]);
    expect(await listCheckpoints(config.id)).toEqual([]);
  });

  it('still saves a trashed run, which can come back from Trash', async () => {
    const { config, trainer } = await toyRun();
    const heard: unknown[] = [];
    const stop = onRunsRemoved((removed) => heard.push(removed));
    await trashRun(config.id);
    stop();
    const saver = new RunSaver();
    await saver.generation(toyGeneration(trainer));
    await saver.checkpoint(config.id, 1, trainer.toState());
    expect(heard).toEqual([[config.id]]);
    expect((await loadHistory(config.id)).map((r) => r.generation)).toEqual([0]);
    expect((await listCheckpoints(config.id)).map((c) => c.generation)).toEqual([1]);
  });

  it('tells subscribers when the backlog changes', async () => {
    const { trainer } = await toyRun();
    const saver = new RunSaver();
    const seen: number[] = [];
    const stop = saver.subscribe(() => seen.push(saver.backlog));
    await saver.generation(toyGeneration(trainer));
    stop();
    void saver.generation(toyGeneration(trainer));
    expect(seen).toEqual([1, 0]);
  });
});

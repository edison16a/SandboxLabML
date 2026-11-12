import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AnyEpisodeModule } from '@/engine/env/episode';
import { loadEpisodeModule } from '@/engine/env/registry';
import { NAVIGATION_BLUEPRINTS } from '@/engine/navigation/pipeline/blueprints';
import { navigationSettings } from '@/engine/navigation/pipeline/settings';
import { Network } from '@/engine/neat/network';
import { EpisodeTrainer, trainingControllerSeed } from '@/engine/training/episodeTrainer';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { latestCheckpoint, saveCheckpoint, listCheckpoints } from './checkpoints';
import { SandboxDb, setDb } from './db';
import { exportRun, importRun } from './exportImport';
import { loadHistory, saveGeneration } from './generations';
import { branchRun, resetRun } from './runActions';
import { createRun, getRun, listRuns, listTrash, purgeTrash, restoreRun, trashRun } from './runs';

let n = 0;
let navigation: AnyEpisodeModule;
beforeAll(async () => {
  navigation = await loadEpisodeModule('navigation');
});
beforeEach(() => setDb(new SandboxDb(`test-${n++}`)));

/** One generation the way the sim workers run it, without the threads. */
function generation(t: EpisodeTrainer) {
  const env = navigation.createEnv(t.setup() as never, t.host(), trainingControllerSeed(t.generation));
  env.reset(
    t.genomes.map((g) => new Network(g)),
    t.seeds(),
    t.slots(),
  );
  while (!env.done) env.step();
  return t.complete(env.results() as never, 1);
}

/** A stored Navigation run with its history and a checkpoint, the way the lab leaves one. */
async function trainedRun(generations = 3) {
  const config = createEpisodeRunConfig({ env: 'navigation', name: 'r', seed: 4, blueprint: NAVIGATION_BLUEPRINTS[1], populationSize: 20, settings: { ...navigationSettings() } });
  await createRun(config);
  const t = new EpisodeTrainer(navigation, config);
  for (let i = 0; i < generations; i++) await saveGeneration(generation(t));
  await saveCheckpoint(config.id, t.generation, t.toState());
  return { config, trainer: t };
}

describe('runs and trash', () => {
  it('soft deletes, restores intact, and purges after 7 days', async () => {
    const { config } = await trainedRun(2);
    await trashRun(config.id);
    expect(await listRuns()).toHaveLength(0);
    expect(await listTrash()).toHaveLength(1);
    await restoreRun(config.id);
    expect((await listRuns())[0].id).toBe(config.id);
    expect(await loadHistory(config.id)).toHaveLength(2);
    await trashRun(config.id);
    // Pass the clock in rather than faking timers: Dexie schedules work on real timers.
    expect(await purgeTrash(Date.now() + 6 * 24 * 3600 * 1000)).toBe(0);
    expect(await purgeTrash(Date.now() + 8 * 24 * 3600 * 1000)).toBe(1);
    expect(await getRun(config.id)).toBeUndefined();
    expect(await loadHistory(config.id)).toHaveLength(0);
  });

  it('hides runs of an env this build does not have, but still purges them', async () => {
    const { config } = await trainedRun(1);
    // A run saved by a build that had an env this one lacks, such as one removed since.
    const gone = { ...config, id: 'gone', env: 'retired' as never };
    await createRun(gone);
    expect((await listRuns()).map((r) => r.id)).toEqual([config.id]);
    await trashRun('gone');
    expect(await listTrash()).toHaveLength(0);
    expect(await purgeTrash(Date.now() + 8 * 24 * 3600 * 1000)).toBe(1);
    expect(await getRun('gone')).toBeUndefined();
    await expect(importRun(JSON.stringify({ ...(await exportRun(config.id)), config: gone }))).rejects.toThrow('This run is from a lab this version does not have.');
    await expect(importRun(JSON.stringify({ ...(await exportRun(config.id)), config: { ...gone, blueprint: undefined } }))).rejects.toThrow('incomplete');
  });

  it('keeps only the newest three checkpoints', async () => {
    const { config, trainer } = await trainedRun(1);
    for (let g = 1; g <= 5; g++) await saveCheckpoint(config.id, g * 10, trainer.toState());
    expect((await listCheckpoints(config.id)).map((c) => c.generation)).toEqual([30, 40, 50]);
  });
});

describe('export and import', () => {
  it('round-trips a run with its history under a new id', async () => {
    const { config } = await trainedRun(3);
    const file = JSON.stringify(await exportRun(config.id));
    const imported = await importRun(file);
    expect(imported.id).not.toBe(config.id);
    const a = await loadHistory(config.id);
    const b = await loadHistory(imported.id);
    expect(b.map((r) => r.genome)).toEqual(a.map((r) => r.genome));
    expect((await latestCheckpoint(imported.id))?.generation).toBe(3);
  });

  it('refuses files that are not run exports', async () => {
    await expect(importRun('{"format":"other"}')).rejects.toThrow('not a SandboxLab run file');
    await expect(importRun('alert(1)')).rejects.toThrow('not valid JSON');
  });
});

describe('branch and reset', () => {
  it('branches from a generation without touching the original', async () => {
    const { config } = await trainedRun(3);
    const branch = await branchRun(config.id, 1);
    expect(branch.parent).toEqual({ runId: config.id, generation: 1 });
    expect((await latestCheckpoint(branch.id))?.generation).toBe(0);
    expect(await loadHistory(config.id)).toHaveLength(3);
  });

  it('resets into a fresh run and trashes the old one', async () => {
    const { config } = await trainedRun(2);
    const fresh = await resetRun(config.id);
    expect(fresh.seed).toBe(config.seed);
    expect((await listTrash()).map((r) => r.id)).toEqual([config.id]);
  });
});

describe('grow a brain', () => {
  it('forks a trained run onto a bigger blueprint and keeps training', async () => {
    const { forkRun } = await import('./forkRun');
    const { config } = await trainedRun(2);
    const grown = await forkRun(config.id, NAVIGATION_BLUEPRINTS[2]);
    const cp = await latestCheckpoint(grown.id);
    const t = new EpisodeTrainer(navigation, grown, cp!.state as never);
    expect(t.genomes[0].inputs).toHaveLength(navigation.inputCount(NAVIGATION_BLUEPRINTS[2].inputs));
    expect(generation(t).generation).toBe(2);
  });
});

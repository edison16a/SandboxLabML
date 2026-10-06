import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { evaluateRacing } from '@/engine/racing/episode';
import { envOptionsFor, TrackCache } from '@/engine/training/racingSetup';
import { RacingTrainer } from '@/engine/training/racingTrainer';
import { createRacingRunConfig } from '@/engine/training/runConfig';
import { latestCheckpoint, saveCheckpoint, listCheckpoints } from './checkpoints';
import { SandboxDb, setDb } from './db';
import { exportRun, importRun } from './exportImport';
import { loadHistory, saveGeneration } from './generations';
import { branchRun, resetRun } from './runActions';
import { createRun, getRun, listRuns, listTrash, purgeTrash, restoreRun, trashRun } from './runs';

let n = 0;
beforeEach(() => setDb(new SandboxDb(`test-${n++}`)));

async function trainedRun(generations = 3) {
  const config = createRacingRunConfig({ name: 'r', seed: 4, blueprint: RACING_BLUEPRINTS[2], track: BUILT_IN_TRACKS[0], carPreset: 'standard', populationSize: 20 });
  await createRun(config);
  const t = new RacingTrainer(config);
  const cache = new TrackCache();
  for (let i = 0; i < generations; i++) {
    const setup = t.setup();
    const results = evaluateRacing(t.genomes, envOptionsFor(setup, cache.get(setup.track), t.host(), 0), t.seeds());
    await saveGeneration(t.complete(results, 1));
  }
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
    const { forkRacingRun } = await import('./forkRun');
    const { config } = await trainedRun(2);
    const grown = await forkRacingRun(config.id, RACING_BLUEPRINTS[3]);
    const cp = await latestCheckpoint(grown.id);
    const t = new RacingTrainer(grown, cp!.state as never);
    expect(t.genomes[0].inputs).toHaveLength(15);
    const cache = new TrackCache();
    const setup = t.setup();
    const results = evaluateRacing(t.genomes, envOptionsFor(setup, cache.get(setup.track), t.host(), 0), t.seeds());
    expect(t.complete(results, 1).generation).toBe(2);
  });
});

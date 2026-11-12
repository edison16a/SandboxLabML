import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DRIVING_BLUEPRINT } from '@/engine/driving/blueprints';
import { defaultDrivingRun } from '@/features/driving/hooks/defaultRun';
import { SandboxDb, setDb, db, type RunRow } from '@/storage/db';
import { EXPORT_FORMAT, ImportError, exportRun, importRun } from '@/storage/exportImport';
import { createRun, getRun, listRuns, trashRun } from '@/storage/runs';
import { emptyLabTrash, forkLabRun, requireLabRun, RETIRED_RUN, runLink } from './labRuns';

let n = 0;
beforeEach(() => setDb(new SandboxDb(`lab-runs-${n++}`)));

/** A run file as an older version exported it, from a lab this version no longer shows. */
function oldExport(env: string): string {
  const config = { ...defaultDrivingRun(), env, name: 'Old run' };
  return JSON.stringify({ format: EXPORT_FORMAT, version: 1, exportedAt: '2026-01-01T00:00:00Z', engineVersion: 1, config, generations: [], checkpoint: null });
}

/** A stored row of a removed lab, as an earlier version left it in IndexedDB. */
async function storedOldRun(env: string): Promise<RunRow> {
  const row = await createRun({ ...defaultDrivingRun(), env } as unknown as RunRow['config']);
  return { ...row, env } as RunRow;
}

describe('runs of removed labs', () => {
  it('stay in storage but never show', async () => {
    const kept = await createRun(defaultDrivingRun());
    await storedOldRun('racing');
    await storedOldRun('hideseek');
    expect((await db().runs.count())).toBe(3);
    expect((await listRuns()).map((r) => r.id)).toEqual([kept.id]);
  });

  it('stay stored when the Trash the page shows is emptied', async () => {
    const shown = await createRun(defaultDrivingRun());
    await trashRun(shown.id);
    const old = await storedOldRun('hideseek');
    await trashRun(old.id);
    await emptyLabTrash();
    expect(await getRun(shown.id)).toBeUndefined();
    expect((await getRun(old.id))?.deletedAt).toBeGreaterThan(0);
  });

  it('turn away an old export file with one plain sentence and store nothing', async () => {
    for (const env of ['racing', 'hideseek']) await expect(importRun(oldExport(env))).rejects.toThrow(new ImportError(RETIRED_RUN));
    expect(await db().runs.count()).toBe(0);
  });

  it('keep the import message for a broken file and import a Driving run', async () => {
    await expect(importRun('not json')).rejects.toThrow('This file is not valid JSON.');
    const original = await createRun(defaultDrivingRun());
    const imported = await importRun(JSON.stringify(await exportRun(original.id)));
    expect(imported.env).toBe('driving');
    expect(imported.name).toBe('First drives (imported)');
  });

  it('refuse a fork or a branch of an old run before touching storage', async () => {
    const old = await storedOldRun('racing');
    expect(() => requireLabRun(old)).toThrow(RETIRED_RUN);
    await expect(forkLabRun({ id: old.id, env: 'racing' as RunRow['env'] }, DEFAULT_DRIVING_BLUEPRINT)).rejects.toThrow(RETIRED_RUN);
    expect(await db().runs.count()).toBe(1);
  });
});

describe('run links', () => {
  it('open a run of the same lab', async () => {
    const run = await createRun(defaultDrivingRun());
    expect(runLink(await getRun(run.id), 'driving', run.id)).toEqual({ kind: 'open' });
  });

  it('move to the lab a run belongs to', async () => {
    const run = await createRun(defaultDrivingRun());
    expect(runLink(await getRun(run.id), 'navigation', run.id)).toEqual({ kind: 'elsewhere', path: `/lab/driving?run=${run.id}` });
  });

  it('explain a missing, trashed or removed lab run in one sentence instead of resuming it', async () => {
    expect(runLink(undefined, 'driving', 'gone')).toEqual({ kind: 'problem', message: 'That run is not on this device any more.' });
    const old = await storedOldRun('racing');
    expect(runLink(old, 'driving', old.id)).toEqual({ kind: 'problem', message: RETIRED_RUN });
    const trashed = await createRun(defaultDrivingRun());
    await trashRun(trashed.id);
    expect(runLink(await getRun(trashed.id), 'driving', trashed.id)).toEqual({ kind: 'problem', message: 'That run is in the Trash. Restore it from the Runs page.' });
  });
});

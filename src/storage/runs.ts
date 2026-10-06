import type { RunConfig } from '@/engine/training/runConfig';
import { db, type RunRow } from './db';

export const TRASH_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export async function createRun(config: RunConfig): Promise<RunRow> {
  const row: RunRow = {
    id: config.id,
    name: config.name,
    env: config.env,
    config,
    createdAt: config.createdAt,
    updatedAt: Date.now(),
    generation: 0,
    bestFitness: 0,
    bestDistance: 0,
    bestLapTime: 0,
  };
  await db().runs.put(row);
  return row;
}

export function getRun(id: string): Promise<RunRow | undefined> {
  return db().runs.get(id);
}

/** Active runs, newest first. Trashed runs are listed separately. */
export async function listRuns(): Promise<RunRow[]> {
  const rows = await db().runs.orderBy('updatedAt').reverse().toArray();
  return rows.filter((r) => !r.deletedAt);
}

export async function listTrash(): Promise<RunRow[]> {
  const rows = await db().runs.toArray();
  return rows.filter((r) => r.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export async function updateRun(id: string, patch: Partial<RunRow>): Promise<void> {
  await db().runs.update(id, { ...patch, updatedAt: Date.now() });
}

export async function renameRun(id: string, name: string): Promise<void> {
  const run = await getRun(id);
  if (!run) return;
  await updateRun(id, { name, config: { ...run.config, name } });
}

/** Moves a run to Trash. It can be restored for 7 days. */
export async function trashRun(id: string): Promise<void> {
  await db().runs.update(id, { deletedAt: Date.now() });
}

export async function restoreRun(id: string): Promise<void> {
  await db().runs.update(id, { deletedAt: undefined, updatedAt: Date.now() });
}

/** Deletes a run and everything stored under it, for good. */
export async function destroyRun(id: string): Promise<void> {
  const d = db();
  await d.transaction('rw', [d.runs, d.generations, d.hsGenerations, d.checkpoints, d.pathCache, d.benchmarks], async () => {
    await d.generations.where('runId').equals(id).delete();
    await d.hsGenerations.where('runId').equals(id).delete();
    await d.checkpoints.where('runId').equals(id).delete();
    await d.pathCache.where('runId').equals(id).delete();
    await d.benchmarks.where('runId').equals(id).delete();
    await d.runs.delete(id);
  });
}

/** Removes trashed runs older than the undo window. Called once on load. */
export async function purgeTrash(now = Date.now()): Promise<number> {
  const old = (await listTrash()).filter((r) => (r.deletedAt ?? now) < now - TRASH_DAYS * DAY);
  for (const r of old) await destroyRun(r.id);
  return old.length;
}

export async function emptyTrash(): Promise<void> {
  for (const r of await listTrash()) await destroyRun(r.id);
}

/** Wipes every table. The UI asks for typed confirmation first. */
export async function deleteAllData(): Promise<void> {
  const d = db();
  await Promise.all(d.tables.map((t) => t.clear()));
}

import { db, type CheckpointRow } from './db';

/** How many population checkpoints are kept per run. */
export const KEEP_CHECKPOINTS = 3;

/** Saves a whole-population checkpoint and drops all but the newest three. */
export async function saveCheckpoint(runId: string, generation: number, state: unknown): Promise<void> {
  const bytes = new Blob([JSON.stringify(state)]).size;
  const d = db();
  await d.checkpoints.put({ runId, generation, state, createdAt: Date.now(), bytes });
  const all = await d.checkpoints.where('runId').equals(runId).sortBy('generation');
  const stale = all.slice(0, Math.max(0, all.length - KEEP_CHECKPOINTS));
  await d.checkpoints.bulkDelete(stale.map((c) => [c.runId, c.generation] as [string, number]));
}

export async function listCheckpoints(runId: string): Promise<CheckpointRow[]> {
  return db().checkpoints.where('runId').equals(runId).sortBy('generation');
}

export async function latestCheckpoint(runId: string): Promise<CheckpointRow | undefined> {
  const all = await listCheckpoints(runId);
  return all[all.length - 1];
}

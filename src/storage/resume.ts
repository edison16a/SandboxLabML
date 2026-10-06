import { db, type CheckpointRow } from './db';
import { listCheckpoints } from './checkpoints';

/** How many generations from 0 are stored with no gap. */
function contiguous(generations: number[]): number {
  const have = new Set(generations);
  let n = 0;
  while (have.has(n)) n++;
  return n;
}

/**
 * The newest checkpoint the stored history reaches without a gap. A
 * checkpoint at generation G resumes training at G, so the history must
 * hold every generation before it. Writes lost when a tab closed can leave
 * the newest checkpoint ahead of the history; an older one then serves.
 * Undefined means start over, which is safe because training is deterministic.
 */
export function pickResumeCheckpoint<C extends { generation: number }>(historyGenerations: number[], checkpoints: C[]): C | undefined {
  const have = contiguous(historyGenerations);
  return [...checkpoints].sort((a, b) => b.generation - a.generation).find((c) => c.generation <= have);
}

/**
 * Lines a stored run's history up with the checkpoint it will resume from.
 * Generations from that point on are deleted (training brings the very same
 * ones back), and so are checkpoints past it, which would otherwise crowd
 * out the new ones the resumed run saves.
 */
export async function alignHistory<R extends { generation: number }>(
  runId: string,
  history: R[],
  deleteGenerationsFrom: (runId: string, generation: number) => Promise<void>,
): Promise<{ history: R[]; checkpoint?: CheckpointRow }> {
  const checkpoints = await listCheckpoints(runId);
  const checkpoint = pickResumeCheckpoint(history.map((r) => r.generation), checkpoints);
  const from = checkpoint?.generation ?? 0;
  if (history.some((r) => r.generation >= from)) await deleteGenerationsFrom(runId, from);
  const stale = checkpoints.filter((c) => c.generation > from);
  if (stale.length) await db().checkpoints.bulkDelete(stale.map((c) => [c.runId, c.generation] as [string, number]));
  return { history: history.filter((r) => r.generation < from), checkpoint };
}

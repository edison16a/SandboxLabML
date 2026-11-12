import type { EpisodeTrainerState } from '@/engine/training/episodeTrainer';
import type { GenerationRecord } from '@/engine/training/records';
import { deleteGenerationsFrom, loadHistory, resetSummary } from '@/storage/generations';
import { alignHistory } from '@/storage/resume';

/**
 * Lines a stored run's history up with the checkpoint it resumes from
 * before it opens. See alignHistory for how lost writes are handled. When
 * that drops generations, the run's summary is rebuilt from what is left.
 */
export async function restoreHistory(runId: string): Promise<{ history: GenerationRecord[]; state?: EpisodeTrainerState }> {
  const stored = await loadHistory(runId);
  const { history, checkpoint } = await alignHistory(runId, stored, deleteGenerationsFrom);
  if (history.length < stored.length) await resetSummary(runId, history);
  return { history, state: checkpoint?.state as EpisodeTrainerState | undefined };
}

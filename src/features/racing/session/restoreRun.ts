import type { RacingTrainerState } from '@/engine/training/racingTrainer';
import type { RacingRecord } from '@/engine/training/records';
import { deleteGenerationsFrom, loadHistory } from '@/storage/generations';
import { alignHistory } from '@/storage/resume';

/**
 * Lines a stored run's history up with the checkpoint it resumes from
 * before it opens. See alignHistory for how lost writes are handled.
 */
export async function restoreRacingHistory(runId: string): Promise<{ history: RacingRecord[]; state?: RacingTrainerState }> {
  const { history, checkpoint } = await alignHistory(runId, await loadHistory(runId), deleteGenerationsFrom);
  return { history: history as RacingRecord[], state: checkpoint?.state as RacingTrainerState | undefined };
}

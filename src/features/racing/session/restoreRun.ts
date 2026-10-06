import type { RacingTrainerState } from '@/engine/training/racingTrainer';
import type { GenerationRecord } from '@/engine/training/records';
import { latestCheckpoint } from '@/storage/checkpoints';
import { deleteGenerationsFrom, loadHistory } from '@/storage/generations';

/**
 * Lines a stored run's history up with its newest checkpoint before it
 * opens. Generations saved after that checkpoint are dropped: training is
 * deterministic, so resuming brings the very same generations back. A run
 * with no checkpoint yet starts over for the same reason.
 */
export async function restoreRacingHistory(runId: string): Promise<{ history: GenerationRecord[]; state?: RacingTrainerState }> {
  const checkpoint = await latestCheckpoint(runId);
  const history = await loadHistory(runId);
  if (checkpoint) {
    await deleteGenerationsFrom(runId, checkpoint.generation);
    return { history: history.filter((r) => r.generation < checkpoint.generation), state: checkpoint.state as RacingTrainerState };
  }
  if (history.length) await deleteGenerationsFrom(runId, 0);
  return { history: [] };
}

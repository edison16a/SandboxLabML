import type { HideSeekRecord } from '@/engine/training/hideseekRecords';
import { setHideSeekGenerationBenchmark } from '@/storage/hideSeekGenerations';
import { updateRun } from '@/storage/runs';
import type { HideSeekPool } from '@/workers/client/hideSeekPool';
import { useHideSeekLab } from '../state/hideSeekStore';

/**
 * Benchmark every tenth generation's champion pair. The exam plays 180
 * matches, far more than a Racing exam's episodes cost, so it runs half as
 * often as Racing's.
 */
export const HS_BENCH_EVERY = 10;

let queue: Promise<void> = Promise.resolve();

/**
 * Queues a background benchmark of a generation's champion pair in the
 * replay worker. Results land on the record (for the benchmark curve), in
 * IndexedDB and on the run's summary. One at a time, so a burst of Max
 * generations never piles up work.
 */
export function maybeBenchmarkPair(pool: HideSeekPool, record: HideSeekRecord): void {
  if (record.generation % HS_BENCH_EVERY !== 0) return;
  queue = queue.then(async () => {
    const run = useHideSeekLab.getState().run;
    if (!run || run.id !== record.runId) return;
    try {
      const result = await pool.replay.benchmark(run, { hider: record.hiderChampion, seeker: record.seekerChampion });
      if (!result) return;
      const s = useHideSeekLab.getState();
      if (s.run?.id !== record.runId) return;
      s.set({ records: s.records.map((r) => (r.generation === record.generation ? { ...r, benchmark: result.score } : r)) });
      await setHideSeekGenerationBenchmark(record.runId, record.generation, result.score);
      await updateRun(record.runId, { benchmark: result.score });
    } catch {
      // A failed background benchmark only means a missing point on the curve.
    }
  });
}

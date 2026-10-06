import type { GenerationRecord } from '@/engine/training/records';
import { setGenerationBenchmark } from '@/storage/generations';
import { updateRun } from '@/storage/runs';
import type { WorkerPool } from '@/workers/client/workerPool';
import { useRacingLab } from '../state/labStore';

/** Benchmark every fifth generation's champion; the bench is cheap but not free. */
export const BENCH_EVERY = 5;

let queue: Promise<void> = Promise.resolve();

/**
 * Queues a background benchmark of a generation's champion in the replay
 * worker. Results land on the record (for the benchmark curve), in IndexedDB
 * and on the run's summary. One at a time, so a burst of Turbo generations
 * never piles up work.
 */
export function maybeBenchmark(pool: WorkerPool, record: GenerationRecord): void {
  if (record.generation % BENCH_EVERY !== 0) return;
  queue = queue.then(async () => {
    const run = useRacingLab.getState().run;
    if (!run || run.id !== record.runId) return;
    try {
      const result = await pool.replay.benchmark(run, record.genome);
      if (!result) return;
      const s = useRacingLab.getState();
      if (s.run?.id !== record.runId) return;
      s.set({ records: s.records.map((r) => (r.generation === record.generation ? { ...r, benchmark: result.score } : r)) });
      await setGenerationBenchmark(record.runId, record.generation, result.score);
      await updateRun(record.runId, { benchmark: result.score });
    } catch {
      // A failed background benchmark only means a missing point on the curve.
    }
  });
}

import type { GenerationRecord } from '@/engine/training/records';
import { setGenerationBenchmark } from '@/storage/generations';
import { updateRun } from '@/storage/runs';
import type { WorkerPool } from '@/workers/client/workerPool';
import type { LabStoreApi } from '../state/labState';

/** Benchmark every fifth generation's champion; the bench is cheap but not free. */
export const BENCH_EVERY = 5;

/** The benchmark waiting for the one in progress to finish. Only the newest waits; see maybeBenchmark. */
let waiting: (() => Promise<void>) | null = null;
let running = false;

/**
 * Queues a background benchmark of a generation's champion in the replay
 * worker. Results land on the record (for the benchmark curve), in IndexedDB
 * and on the run's summary. One runs at a time, and only the newest asked
 * for waits behind it: an exam that takes longer than five generations
 * (Driving's, under Max) skips the champions in between instead of piling
 * up work that would run for minutes after training stops. An env without
 * a benchmark scores nothing.
 */
export function maybeBenchmark(pool: WorkerPool, store: LabStoreApi, record: GenerationRecord): void {
  if (record.generation % BENCH_EVERY !== 0) return;
  waiting = () => benchmarkOne(pool, store, record);
  if (!running) void drain();
}

async function drain(): Promise<void> {
  running = true;
  while (waiting) {
    const job = waiting;
    waiting = null;
    await job();
  }
  running = false;
}

async function benchmarkOne(pool: WorkerPool, store: LabStoreApi, record: GenerationRecord): Promise<void> {
  const run = store.getState().run;
  if (!run || run.id !== record.runId) return;
  try {
    const result = await pool.replay.benchmark(run, record.genome);
    if (!result) return;
    const s = store.getState();
    if (s.run?.id !== record.runId) return;
    store.setState({ records: s.records.map((r) => (r.generation === record.generation ? { ...r, benchmark: result.score } : r)) });
    await setGenerationBenchmark(record.runId, record.generation, result.score);
    await updateRun(record.runId, { benchmark: result.score });
  } catch {
    // A failed background benchmark only means a missing point on the curve.
  }
}

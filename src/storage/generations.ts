import { decodeGenome, encodeGenome } from '@/engine/neat/serialize';
import type { Genome } from '@/engine/neat/types';
import type { GenerationRecord } from '@/engine/training/records';
import { db, type GenerationRow } from './db';
import { foldSummary } from './runBest';

export { summaryAfter } from './runBest';

export function toRow(r: GenerationRecord): GenerationRow {
  return {
    runId: r.runId,
    generation: r.generation,
    stats: r.stats,
    champion: r.champion,
    genome: encodeGenome(r.genome),
    trackHash: r.trackHash,
    replaySeed: r.replaySeed,
    ...(r.replaySlot !== undefined && { replaySlot: r.replaySlot }),
    simSeconds: r.simSeconds,
    wallMs: r.wallMs,
    markers: r.markers,
    benchmark: r.benchmark,
    ...(r.metrics && { metrics: r.metrics }),
    ...(r.content !== undefined && { content: r.content }),
  };
}

export function fromRow(row: GenerationRow): GenerationRecord {
  return { ...row, genome: decodeGenome(row.genome) };
}

/** Saves a finished generation and refreshes the run's summary on the Runs page. */
export async function saveGeneration(r: GenerationRecord): Promise<void> {
  await saveGenerations([r]);
}

/**
 * Saves finished generations in one transaction and refreshes each run's
 * summary once. On Turbo and Max many generations finish each second, and
 * three small writes per generation fell far behind on a busy machine.
 * Records of a run whose row is gone (deleted for good while its backlog
 * waited) are dropped: nothing would ever clean them up.
 */
export async function saveGenerations(records: readonly GenerationRecord[]): Promise<void> {
  if (records.length === 0) return;
  const d = db();
  await d.transaction('rw', d.generations, d.runs, async () => {
    for (const runId of new Set(records.map((r) => r.runId))) {
      const run = await d.runs.get(runId);
      if (!run) continue;
      const mine = records.filter((r) => r.runId === runId);
      await d.generations.bulkPut(mine.map(toRow));
      await d.runs.update(runId, { ...foldSummary(run, mine), updatedAt: Date.now() });
    }
  });
}

export async function loadHistory(runId: string): Promise<GenerationRecord[]> {
  const rows = await db().generations.where('runId').equals(runId).sortBy('generation');
  return rows.map(fromRow);
}

export async function loadChampion(runId: string, generation: number): Promise<Genome | null> {
  const row = await db().generations.get([runId, generation]);
  return row ? decodeGenome(row.genome) : null;
}

export async function setGenerationBenchmark(runId: string, generation: number, score: number): Promise<void> {
  await db().generations.update([runId, generation], { benchmark: score });
}

/** Drops generations at or after `generation`, used when resuming from an older checkpoint. */
export async function deleteGenerationsFrom(runId: string, generation: number): Promise<void> {
  await db()
    .generations.where('runId')
    .equals(runId)
    .filter((g) => g.generation >= generation)
    .delete();
}

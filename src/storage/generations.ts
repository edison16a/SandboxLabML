import { decodeGenome, encodeGenome } from '@/engine/neat/serialize';
import type { Genome } from '@/engine/neat/types';
import type { GenerationRecord } from '@/engine/training/records';
import { db, type GenerationRow } from './db';
import { updateRun } from './runs';

export function toRow(r: GenerationRecord): GenerationRow {
  return {
    runId: r.runId,
    generation: r.generation,
    stats: r.stats,
    champion: r.champion,
    genome: encodeGenome(r.genome),
    trackHash: r.trackHash,
    replaySeed: r.replaySeed,
    simSeconds: r.simSeconds,
    wallMs: r.wallMs,
    markers: r.markers,
    benchmark: r.benchmark,
  };
}

export function fromRow(row: GenerationRow): GenerationRecord {
  return { ...row, genome: decodeGenome(row.genome) };
}

/** Saves a finished generation and refreshes the run's summary on the Runs page. */
export async function saveGeneration(r: GenerationRecord): Promise<void> {
  await db().generations.put(toRow(r));
  const run = await db().runs.get(r.runId);
  if (!run) return;
  await updateRun(r.runId, {
    generation: r.generation + 1,
    bestFitness: Math.max(run.bestFitness, r.champion.fitness),
    bestDistance: Math.max(run.bestDistance, r.champion.distance),
    bestLapTime:
      r.champion.bestLapTime > 0 ? (run.bestLapTime > 0 ? Math.min(run.bestLapTime, r.champion.bestLapTime) : r.champion.bestLapTime) : run.bestLapTime,
    benchmark: r.benchmark ?? run.benchmark,
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

import type { HideSeekGenerationStats } from '@/engine/hideseek/trainer/types';
import { decodeGenome, encodeGenome } from '@/engine/neat/serialize';
import type { Genome } from '@/engine/neat/types';
import type { HideSeekRecord, RoundReplay } from '@/engine/training/hideseekRecords';
import { db, type HideSeekGenerationRow } from './db';
import { updateRun } from './runs';

/**
 * Generations that keep their last round for replay. A round holds up to
 * fifty matches worth of genomes, so only the newest few keep one; older
 * generations keep their champions, which is all the Sandbox needs.
 */
export const KEEP_REPLAYS = 3;

/** A replay as stored: genomes in the compact binary format. */
type StoredReplay = Omit<RoundReplay, 'genomes'> & { genomes: Uint8Array[] };

export function toHideSeekRow(r: HideSeekRecord): HideSeekGenerationRow {
  const replay: StoredReplay | undefined = r.replay ? { ...r.replay, genomes: r.replay.genomes.map(encodeGenome) } : undefined;
  return {
    runId: r.runId,
    generation: r.generation,
    stats: r.stats,
    hiderChampion: encodeGenome(r.hiderChampion),
    seekerChampion: encodeGenome(r.seekerChampion),
    replay,
    simSeconds: r.simSeconds,
    wallMs: r.wallMs,
  };
}

export function fromHideSeekRow(row: HideSeekGenerationRow): HideSeekRecord {
  const stored = row.replay as StoredReplay | undefined;
  return {
    runId: row.runId,
    generation: row.generation,
    stats: row.stats as HideSeekGenerationStats,
    hiderChampion: decodeGenome(row.hiderChampion),
    seekerChampion: decodeGenome(row.seekerChampion),
    replay: stored ? { ...stored, genomes: stored.genomes.map(decodeGenome) } : undefined,
    simSeconds: row.simSeconds,
    wallMs: row.wallMs,
  };
}

/** Saves a generation, drops replays that fell out of the window and refreshes the run's summary row. */
export async function saveHideSeekGeneration(r: HideSeekRecord): Promise<void> {
  const d = db();
  await d.hsGenerations.put(toHideSeekRow(r));
  await d.hsGenerations
    .where('runId')
    .equals(r.runId)
    .filter((g) => g.replay !== undefined && g.generation <= r.generation - KEEP_REPLAYS)
    .modify((g) => {
      delete g.replay;
    });
  const run = await d.runs.get(r.runId);
  if (!run) return;
  await updateRun(r.runId, { generation: r.generation + 1, bestFitness: Math.max(run.bestFitness, r.stats.hiders.best) });
}

export async function loadHideSeekHistory(runId: string): Promise<HideSeekRecord[]> {
  const rows = await db().hsGenerations.where('runId').equals(runId).sortBy('generation');
  return rows.map(fromHideSeekRow);
}

/** Both champions of one generation, for the Sandbox. */
export async function loadHideSeekChampions(runId: string, generation: number): Promise<{ hider: Genome; seeker: Genome } | null> {
  const row = await db().hsGenerations.get([runId, generation]);
  return row ? { hider: decodeGenome(row.hiderChampion), seeker: decodeGenome(row.seekerChampion) } : null;
}

/** Drops generations at or after `generation`, used when resuming from an older checkpoint. */
export async function deleteHideSeekGenerationsFrom(runId: string, generation: number): Promise<void> {
  await db()
    .hsGenerations.where('runId')
    .equals(runId)
    .filter((g) => g.generation >= generation)
    .delete();
}

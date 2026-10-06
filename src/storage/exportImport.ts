import { ENGINE_VERSION } from '@/engine/core/version';
import { base64ToBytes, bytesToBase64 } from '@/engine/neat/serialize';
import { newRunId, type RunConfig } from '@/engine/training/runConfig';
import { db, type GenerationRow, type HideSeekGenerationRow } from './db';
import { createRun, getRun } from './runs';

export const EXPORT_FORMAT = 'sandboxlab-run';

/** The JSON file a run exports to. Genomes are base64 in the binary format to keep files small. */
export interface RunExport {
  format: typeof EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  engineVersion: number;
  config: RunConfig;
  generations: Array<Omit<GenerationRow, 'genome'> & { genome: string }>;
  /** Hide and Seek runs: both champions per generation. Round replays stay behind to keep files small. */
  hsGenerations?: Array<Omit<HideSeekGenerationRow, 'hiderChampion' | 'seekerChampion' | 'replay'> & { hiderChampion: string; seekerChampion: string }>;
  checkpoint: { generation: number; state: unknown } | null;
}

export async function exportRun(runId: string): Promise<RunExport> {
  const d = db();
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found.');
  const gens = await d.generations.where('runId').equals(runId).sortBy('generation');
  const hs = await d.hsGenerations.where('runId').equals(runId).sortBy('generation');
  const cps = await d.checkpoints.where('runId').equals(runId).sortBy('generation');
  const last = cps[cps.length - 1];
  return {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    config: run.config,
    generations: gens.map((g) => ({ ...g, genome: bytesToBase64(g.genome) })),
    hsGenerations: hs.map(({ replay: _replay, ...g }) => ({ ...g, hiderChampion: bytesToBase64(g.hiderChampion), seekerChampion: bytesToBase64(g.seekerChampion) })),
    checkpoint: last ? { generation: last.generation, state: last.state } : null,
  };
}

export class ImportError extends Error {}

/**
 * Imports a run file. The file is data only: scripts inside it are SBL
 * source that is parsed and checked when the run opens, and nothing in the
 * file is ever executed as JavaScript. The run gets a new id so importing
 * twice never overwrites anything.
 */
export async function importRun(text: string): Promise<RunConfig> {
  let parsed: RunExport;
  try {
    parsed = JSON.parse(text) as RunExport;
  } catch {
    throw new ImportError('This file is not valid JSON.');
  }
  if (parsed?.format !== EXPORT_FORMAT || parsed.version !== 1) throw new ImportError('This is not a SandboxLab run file.');
  const c = parsed.config;
  if (!c || (c.env !== 'racing' && c.env !== 'hideseek') || !c.blueprint || !Array.isArray(c.scripts)) {
    throw new ImportError('The run config in this file is incomplete.');
  }
  for (const s of c.scripts) if (typeof s.source !== 'string') throw new ImportError('A script in this file is not text.');
  const config: RunConfig = { ...c, id: newRunId(), name: `${c.name} (imported)` };
  const d = db();
  await createRun(config);
  const rows: GenerationRow[] = parsed.generations.map((g) => ({ ...g, runId: config.id, genome: base64ToBytes(g.genome) }));
  await d.generations.bulkPut(rows);
  const hsRows: HideSeekGenerationRow[] = (parsed.hsGenerations ?? []).map((g) => ({
    ...g,
    runId: config.id,
    hiderChampion: base64ToBytes(g.hiderChampion),
    seekerChampion: base64ToBytes(g.seekerChampion),
  }));
  await d.hsGenerations.bulkPut(hsRows);
  if (parsed.checkpoint) {
    await d.checkpoints.put({
      runId: config.id,
      generation: parsed.checkpoint.generation,
      state: parsed.checkpoint.state,
      createdAt: Date.now(),
      bytes: JSON.stringify(parsed.checkpoint.state).length,
    });
  }
  const best = rows.reduce((b, r) => Math.max(b, r.champion.fitness), 0);
  await d.runs.update(config.id, { generation: Math.max(rows.length, hsRows.length), bestFitness: best });
  return config;
}

/** Saves a run export through the browser's download flow. */
export function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

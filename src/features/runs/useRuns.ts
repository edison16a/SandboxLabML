'use client';

import { useCallback, useEffect, useState } from 'react';
import { decodeGenome } from '@/engine/neat/serialize';
import { modelMetrics, type ModelMetrics } from '@/engine/neat/metrics';
import { db, type RunRow } from '@/storage/db';
import { listRuns, listTrash } from '@/storage/runs';

export interface RunSummary {
  row: RunRow;
  /** Model card numbers of the latest champion, if any generation finished. */
  model: ModelMetrics | null;
}

async function latestModel(row: RunRow): Promise<ModelMetrics | null> {
  const d = db();
  if (row.env === 'racing') {
    const last = await d.generations.where('runId').equals(row.id).last();
    return last ? modelMetrics(decodeGenome(last.genome)) : null;
  }
  const last = await d.hsGenerations.where('runId').equals(row.id).last();
  return last ? modelMetrics(decodeGenome(last.hiderChampion)) : null;
}

/** Loads active and trashed runs, with a reload function for after each action. */
export function useRuns() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [trash, setTrash] = useState<RunRow[]>([]);
  const reload = useCallback(async () => {
    const rows = await listRuns();
    const summaries = await Promise.all(rows.map(async (row) => ({ row, model: await latestModel(row) })));
    setRuns(summaries);
    setTrash(await listTrash());
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { runs, trash, reload };
}

'use client';

import { useEffect, useState } from 'react';
import { episodeInfo } from '@/engine/env/registry';
import type { Genome } from '@/engine/neat/types';
import type { RunRow } from '@/storage/db';
import { listGenerationNumbers } from '@/storage/generationIndex';
import { loadChampion, setGenerationBenchmark } from '@/storage/generations';
import { listRuns } from '@/storage/runs';

/** A run that has finished at least one generation, so it has a champion to score. */
export interface BenchSource {
  run: RunRow;
  /** Generation of the latest champion. */
  latest: number;
}

/** A run with a champion, whose env has a benchmark and whose brain belongs to that env. listRuns already leaves out runs of removed labs. */
function benchable(r: RunRow): boolean {
  return r.generation > 0 && r.config.blueprint.env === r.env && !!episodeInfo(r.env)?.bench;
}

/** Runs in IndexedDB that the Bench tab can score, newest first. */
export function useBenchSources(): { sources: BenchSource[]; loading: boolean } {
  const [sources, setSources] = useState<BenchSource[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    listRuns()
      .then((runs) => live && setSources(runs.filter(benchable).map((run) => ({ run, latest: run.generation - 1 }))))
      .catch(() => live && setSources([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);
  return { sources, loading };
}

/** Stored generation numbers of a run, oldest first. */
export function generationsOf(run: RunRow): Promise<number[]> {
  return listGenerationNumbers(run.id);
}

/** What the benchmark scores for a generation: its champion. */
export async function loadModel(run: RunRow, generation: number): Promise<Genome | null> {
  return loadChampion(run.id, generation);
}

/** Keeps the score on the generation, so the run's charts and model card see it too. */
export function saveScore(run: RunRow, generation: number, score: number): Promise<void> {
  return setGenerationBenchmark(run.id, generation, score);
}

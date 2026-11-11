'use client';

import { useEffect, useState } from 'react';
import type { BenchModel } from '@/engine/bench';
import { episodeModule } from '@/engine/env/registry';
import type { RunRow } from '@/storage/db';
import { listGenerationNumbers, listHideSeekGenerationNumbers } from '@/storage/generationIndex';
import { loadChampion, setGenerationBenchmark } from '@/storage/generations';
import { loadHideSeekChampions, setHideSeekGenerationBenchmark } from '@/storage/hideSeekGenerations';
import { listRuns } from '@/storage/runs';

/** A run of either environment that has finished at least one generation, so it has a champion to score. */
export interface BenchSource {
  run: RunRow;
  /** Generation of the latest champion. */
  latest: number;
}

/** A run with a champion whose env has a benchmark and whose brain belongs to that env. */
function benchable(r: RunRow): boolean {
  if (r.generation <= 0 || r.config.blueprint.env !== r.env) return false;
  if (r.env === 'hideseek') return true;
  return !!episodeModule(r.env)?.bench && (r.env !== 'racing' || !!r.config.racing);
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

/** Stored generation numbers of a run, oldest first. Each environment keeps its generations in its own table. */
export function generationsOf(run: RunRow): Promise<number[]> {
  return run.env === 'hideseek' ? listHideSeekGenerationNumbers(run.id) : listGenerationNumbers(run.id);
}

/** What the benchmark scores for a generation: the Racing champion, or both Hide and Seek champions. */
export async function loadModel(run: RunRow, generation: number): Promise<BenchModel | null> {
  return run.env === 'hideseek' ? loadHideSeekChampions(run.id, generation) : loadChampion(run.id, generation);
}

/** Keeps the score on the generation, so the run's charts and model card see it too. */
export function saveScore(run: RunRow, generation: number, score: number): Promise<void> {
  return run.env === 'hideseek' ? setHideSeekGenerationBenchmark(run.id, generation, score) : setGenerationBenchmark(run.id, generation, score);
}

'use client';

import { useEffect, useState } from 'react';
import type { RunRow } from '@/storage/db';
import { listRuns } from '@/storage/runs';

/** A racing run that has finished at least one generation, so it has a champion to load. */
export interface ChampionSource {
  run: RunRow;
  /** Generation of the latest champion. */
  latest: number;
}

/** Racing runs in IndexedDB with at least one champion, newest first. Shared by the Test run and Bench tabs. */
export function useRacingChampions(): { sources: ChampionSource[]; loading: boolean } {
  const [sources, setSources] = useState<ChampionSource[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    listRuns()
      .then((runs) => {
        if (!live) return;
        setSources(runs.filter((r) => r.env === 'racing' && r.config.racing && r.config.blueprint.env === 'racing' && r.generation > 0).map((run) => ({ run, latest: run.generation - 1 })));
      })
      .catch(() => live && setSources([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);
  return { sources, loading };
}

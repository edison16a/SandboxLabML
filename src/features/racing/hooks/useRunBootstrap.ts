'use client';

import { useEffect, useState } from 'react';
import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { createRacingRunConfig } from '@/engine/training/runConfig';
import { listRuns, purgeTrash } from '@/storage/runs';
import { getSetting, setSetting } from '@/storage/settings';
import { toast } from '@/ui/toast/toastStore';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';

export const LAST_RUN_KEY = 'racing.lastRun';

/** The run a first-time visitor gets, so the lab is alive the moment it opens. */
export function defaultRacingRun() {
  return createRacingRunConfig({
    name: 'First laps',
    seed: Math.floor(Math.random() * 1e9),
    blueprint: RACING_BLUEPRINTS[2],
    track: BUILT_IN_TRACKS[0],
    carPreset: 'standard',
    populationSize: 100,
  });
}

/**
 * Starts the workers and opens a run: the one in the URL, else the last one
 * used, else the newest racing run, else a fresh default run.
 */
export function useRunBootstrap(runIdFromUrl: string | null) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = racingSession();
      try {
        await session.init();
        await purgeTrash();
        const current = useRacingLab.getState().run;
        const wanted = runIdFromUrl ?? (current ? null : await getSetting<string>(LAST_RUN_KEY));
        if (wanted && wanted !== current?.id && (await session.openRun(wanted))) {
          // opened the requested run
        } else if (!current) {
          const latest = (await listRuns()).find((r) => r.env === 'racing');
          if (!latest || !(await session.openRun(latest.id))) await session.newRun(defaultRacingRun());
        }
        const run = useRacingLab.getState().run;
        if (run) await setSetting(LAST_RUN_KEY, run.id);
      } catch (err) {
        toast.error('Could not start the lab', err instanceof Error ? err.message : String(err));
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [runIdFromUrl]);
  return ready;
}

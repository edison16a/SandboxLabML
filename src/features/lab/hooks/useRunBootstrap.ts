'use client';

import { useEffect, useState } from 'react';
import type { RunConfig } from '@/engine/training/runConfig';
import { listRuns, purgeTrash } from '@/storage/runs';
import { getSetting, setSetting } from '@/storage/settings';
import { toast } from '@/ui/toast/toastStore';
import { useLabContext } from '../LabContext';

/**
 * Starts the workers and opens a run: the one in the URL, else the last one
 * used, else the newest run of the lab's env, else a fresh default run.
 * `defaultRun` builds the run a first time visitor gets, so the lab is
 * alive the moment it opens.
 */
export function useRunBootstrap(runIdFromUrl: string | null, defaultRun: () => RunConfig) {
  const { env, api, session, lastRunKey } = useLabContext();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await session.init();
        await purgeTrash();
        const current = api.getState().run;
        const wanted = runIdFromUrl ?? (current ? null : await getSetting<string>(lastRunKey));
        if (wanted && wanted !== current?.id && (await session.openRun(wanted))) {
          // opened the requested run
        } else if (!current) {
          const latest = (await listRuns()).find((r) => r.env === env);
          if (!latest || !(await session.openRun(latest.id))) await session.newRun(defaultRun());
        }
        const run = api.getState().run;
        if (run) await setSetting(lastRunKey, run.id);
      } catch (err) {
        toast.error('Could not start the lab', err instanceof Error ? err.message : String(err));
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // The lab's context and default run are fixed for the page's life, so only the URL restarts this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runIdFromUrl]);
  return ready;
}

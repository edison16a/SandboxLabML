'use client';

import { useEffect, useState } from 'react';
import { HIDESEEK_BLUEPRINTS } from '@/engine/blueprints/presets';
import { createHideSeekRunConfig } from '@/engine/training/hideseekRunConfig';
import { listRuns, purgeTrash } from '@/storage/runs';
import { getSetting, setSetting } from '@/storage/settings';
import { toast } from '@/ui/toast/toastStore';
import { hideSeekSession } from '../session/HideSeekSession';
import { useHideSeekLab } from '../state/hideSeekStore';

export const HS_LAST_RUN_KEY = 'hideseek.lastRun';

/** The run a first-time visitor gets, so the lab has arenas to show the moment it opens. */
export function defaultHideSeekRun() {
  return createHideSeekRunConfig({
    name: 'First hideouts',
    seed: Math.floor(Math.random() * 1e9),
    blueprint: HIDESEEK_BLUEPRINTS[1],
    populationPerTeam: 50,
  });
}

/**
 * Starts the workers and opens a run: the one in the URL, else the last one
 * used, else the newest Hide and Seek run, else a fresh default run. Also
 * saves a checkpoint when the tab is hidden, since a closed tab gives no
 * other warning.
 */
export function useHideSeekBootstrap(runIdFromUrl: string | null): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = hideSeekSession();
      try {
        await session.init();
        await purgeTrash();
        const current = useHideSeekLab.getState().run;
        const wanted = runIdFromUrl ?? (current ? null : await getSetting<string>(HS_LAST_RUN_KEY));
        if (wanted && wanted !== current?.id && (await session.openRun(wanted))) {
          // opened the requested run
        } else if (!current) {
          const latest = (await listRuns()).find((r) => r.env === 'hideseek');
          if (!latest || !(await session.openRun(latest.id))) await session.newRun(defaultHideSeekRun());
        }
        const run = useHideSeekLab.getState().run;
        if (run) await setSetting(HS_LAST_RUN_KEY, run.id);
      } catch (err) {
        toast.error('Could not start the lab', err instanceof Error ? err.message : String(err));
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [runIdFromUrl]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && useHideSeekLab.getState().status === 'running') void hideSeekSession().saveNow();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
  return ready;
}

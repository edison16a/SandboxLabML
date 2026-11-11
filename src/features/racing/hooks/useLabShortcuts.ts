'use client';

import { useCallback } from 'react';
import { useLabShortcuts as useSharedShortcuts } from '@/features/lab/hooks/useLabShortcuts';
import { racingSession } from '../session/RacingSession';
import { useRacingLab, type CameraMode } from '../state/labStore';

const CAMERAS: readonly CameraMode[] = ['chase', 'orbit', 'trackside', 'top', 'free'];

/**
 * The shared lab shortcuts, plus the Sandbox's own: there Space plays or
 * pauses the race and R restarts it. Training stays paused until the user
 * goes back.
 */
export function useLabShortcuts(onNewRun: () => void) {
  const onKey = useCallback((key: string) => {
    const s = useRacingLab.getState();
    if (s.mode !== 'sandbox') return false;
    const sandbox = racingSession().sandbox;
    if (key === ' ') void sandbox?.setPaused(!s.sandboxPaused);
    else if (key === 'r') void sandbox?.restart();
    else return false;
    return true;
  }, []);
  useSharedShortcuts(onNewRun, { cameras: CAMERAS, onKey });
}

'use client';

import { useCallback } from 'react';
import { useLabShortcuts as useSharedShortcuts } from '@/features/lab/hooks/useLabShortcuts';
import { NAV_CAMERAS } from '@/render/navigation/types';
import { navigationSession } from '../session/NavigationSession';
import { useNavigationLab } from '../state/labStore';

/** The shared lab shortcuts, with C cycling the Navigation cameras. In the Sandbox, Space plays or pauses and R restarts. */
export function useLabShortcuts(onNewRun: () => void) {
  const onKey = useCallback((key: string) => {
    const s = useNavigationLab.getState();
    const sandbox = navigationSession().sandbox;
    if (s.mode !== 'sandbox' || !sandbox) return false;
    if (key === ' ') void sandbox.setPaused(!s.sandbox.paused);
    else if (key === 'r') void sandbox.restart();
    else return false;
    return true;
  }, []);
  useSharedShortcuts(onNewRun, { cameras: NAV_CAMERAS, onKey });
}

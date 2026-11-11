'use client';

import { useCallback } from 'react';
import { useLabShortcuts } from '@/features/lab/hooks/useLabShortcuts';
import { DRIVING_CAMERAS } from '@/render/driving/frame/sceneContext';
import { drivingSession } from '../session/DrivingSession';
import { useDrivingLab } from '../state/labStore';

/**
 * The shared lab shortcuts with the Driving cameras in the order C cycles
 * them. In the Sandbox, Space pauses the trip instead of starting training,
 * and R drives it again from the start.
 */
export function useDrivingShortcuts(onNewRun: () => void) {
  const onKey = useCallback((key: string) => {
    const s = useDrivingLab.getState();
    if (s.mode !== 'sandbox') return false;
    const controls = drivingSession().sandbox;
    if (key === ' ') void controls?.setPaused(!s.sandboxPaused);
    else if (key === 'r') void controls?.restart();
    else return false;
    return true;
  }, []);
  useLabShortcuts(onNewRun, { cameras: DRIVING_CAMERAS, onKey });
}

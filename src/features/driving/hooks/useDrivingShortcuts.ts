'use client';

import { useLabShortcuts } from '@/features/lab/hooks/useLabShortcuts';
import { DRIVING_CAMERAS } from '@/render/driving/frame/sceneContext';

/** The shared lab shortcuts with the Driving cameras in the order C cycles them. */
export function useDrivingShortcuts(onNewRun: () => void) {
  useLabShortcuts(onNewRun, { cameras: DRIVING_CAMERAS });
}

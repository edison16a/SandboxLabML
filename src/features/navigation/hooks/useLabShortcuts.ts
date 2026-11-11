'use client';

import { useLabShortcuts as useSharedShortcuts } from '@/features/lab/hooks/useLabShortcuts';
import { NAV_CAMERAS } from '@/render/navigation/types';

/** The shared lab shortcuts, with C cycling the Navigation cameras. */
export function useLabShortcuts(onNewRun: () => void) {
  useSharedShortcuts(onNewRun, { cameras: NAV_CAMERAS });
}

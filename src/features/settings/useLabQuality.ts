'use client';

import { useLayoutEffect } from 'react';
import { probeWeakGpu } from '@/render/shared/quality';
import { parseQualityPin, resolvedQuality, useSettings, type QualityPin } from './settingsStore';

/**
 * The quality a lab draws at. It probes the GPU once for the default and
 * pins the quality from ?quality= while the lab that carried it is open.
 * Layout effects settle both before the first paint, well before a lab's
 * canvas mounts.
 */
export function useLabQuality(pinParam: string | null): QualityPin {
  useLayoutEffect(() => {
    const s = useSettings.getState();
    if (s.weakGpu === null) s.setWeakGpu(probeWeakGpu());
  }, []);
  useLayoutEffect(() => {
    useSettings.getState().setPinned(parseQualityPin(pinParam));
    return () => useSettings.getState().setPinned(null);
  }, [pinParam]);
  return useSettings(resolvedQuality);
}

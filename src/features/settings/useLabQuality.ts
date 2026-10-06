'use client';

import { useLayoutEffect } from 'react';
import { probeWeakGpu } from '@/render/shared/quality';
import { parseQualityPin, resolvedQuality, useSettings, type QualityPin } from './settingsStore';

/** Probes the GPU the first time anything needs the default quality. */
export function ensureGpuProbed() {
  const s = useSettings.getState();
  if (s.weakGpu === null) s.setWeakGpu(probeWeakGpu());
}

/**
 * The quality a lab draws at. It probes the GPU once for the default and
 * pins the quality from ?quality= while the lab that carried it is open.
 * Layout effects settle both before the first paint, well before a lab's
 * canvas mounts.
 */
export function useLabQuality(pinParam: string | null): QualityPin {
  useLayoutEffect(ensureGpuProbed, []);
  useLayoutEffect(() => {
    useSettings.getState().setPinned(parseQualityPin(pinParam));
    return () => useSettings.getState().setPinned(null);
  }, [pinParam]);
  return useSettings(resolvedQuality);
}

'use client';

import { useLayoutEffect } from 'react';
import { useSettings, type QualityPin } from '@/features/settings/settingsStore';
import { useLabQuality } from '@/features/settings/useLabQuality';
import { gridCapped, useHideSeekLab } from '../state/hideSeekStore';
import type { HsQualityTier } from '../state/types';

/**
 * Maps a Settings quality onto the Hide and Seek tiers. High stays high
 * rather than ultra: ultra quadruples the shadow map and runs ambient
 * occlusion at full resolution, which an ordinary discrete GPU cannot hold
 * next to the two picture in picture views, and High is the default there.
 * Photo mode turns those views off and is about the still, so High steps
 * up to ultra while it is open. ?quality=ultra still pins ultra outright.
 */
export function hideSeekTier(quality: QualityPin, photo: boolean): HsQualityTier {
  return quality === 'high' && photo ? 'ultra' : quality;
}

/** Copies the quality from Settings onto the render tier, and caps the grid on a weak GPU until a quality is picked. */
export function useHideSeekQuality(pinParam: string | null) {
  const quality = useLabQuality(pinParam);
  const photo = useHideSeekLab((s) => s.photoMode);
  const capped = useSettings(gridCapped);
  useLayoutEffect(() => {
    useHideSeekLab.getState().set({ activeTier: hideSeekTier(quality, photo) });
  }, [quality, photo]);
  useLayoutEffect(() => {
    const s = useHideSeekLab.getState();
    if (capped && s.gridSize > 25) s.set({ gridSize: 25, focus: s.focus !== null && s.focus >= 25 ? null : s.focus });
  }, [capped]);
}

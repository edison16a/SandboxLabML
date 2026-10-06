'use client';

import { useLayoutEffect } from 'react';
import { useLabQuality } from '@/features/settings/useLabQuality';
import { useRacingLab } from '../state/labStore';

/**
 * Copies the quality from Settings onto the Racing render tier. Racing has
 * no tier past High, so ?quality=ultra draws at High.
 */
export function useRacingQuality(pinParam: string | null) {
  const quality = useLabQuality(pinParam);
  useLayoutEffect(() => {
    useRacingLab.getState().set({ activeTier: quality === 'ultra' ? 'high' : quality });
  }, [quality]);
}

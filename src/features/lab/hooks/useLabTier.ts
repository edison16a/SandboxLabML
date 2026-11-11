'use client';

import { useLayoutEffect } from 'react';
import { useLabQuality } from '@/features/settings/useLabQuality';
import { useLabContext } from '../LabContext';

/**
 * Copies the quality from Settings onto the lab's render tier. `?quality=`
 * pins it, which slow machines and the browser tests use. A lab with no
 * tier past High draws ?quality=ultra at High.
 */
export function useLabTier(pinParam: string | null) {
  const { api } = useLabContext();
  const quality = useLabQuality(pinParam);
  useLayoutEffect(() => {
    api.setState({ activeTier: quality === 'ultra' ? 'high' : quality });
  }, [api, quality]);
}

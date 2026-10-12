'use client';

import { useCallback } from 'react';
import type { Track } from '@/engine/racing/track/types';
import type { QualityTier } from '@/features/racing/state/labStore';
import { SceneReady } from '@/render/shared/SceneReady';
import { TERRAIN_STEP } from './terrain/Terrain';
import { readTerrain, readWorld } from './worldStore';

interface Props {
  track: Track;
  tier: QualityTier;
  /** A track being drawn shows a level field on purpose, so it counts as ready. */
  editing: boolean;
  onChange: (ready: boolean) => void;
}

/** Reports when the circuit's hills, trees and stands are in, so the lab can lift its loading cover. */
export function WorldReady({ track, tier, editing, onChange }: Props) {
  const isReady = useCallback(() => {
    if (editing) return true;
    const world = readWorld(track);
    return world !== null && readTerrain(world, TERRAIN_STEP[tier]) !== null;
  }, [track, tier, editing]);
  return <SceneReady isReady={isReady} onChange={onChange} />;
}

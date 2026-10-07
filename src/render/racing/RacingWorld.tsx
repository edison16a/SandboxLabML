'use client';

import type * as THREE from 'three';
import { useMemo } from 'react';
import type { Track } from '@/engine/racing/track/types';
import type { QualityTier } from '@/features/racing/state/labStore';
import { RacingEnvironment } from './RacingEnvironment';
import { Stadium } from './stadium/Stadium';
import { TrackMesh } from './TrackMesh';
import { Forest } from './world/flora/Forest';
import { Undergrowth } from './world/flora/Undergrowth';
import { FlatGround } from './world/terrain/FlatGround';
import { Terrain } from './world/terrain/Terrain';
import { worldFor } from './world/worldData';

interface Props {
  track: Track;
  tier: QualityTier;
  /** World point the sun's shadow box follows. */
  focus: React.RefObject<THREE.Vector3>;
  /** While a track is being drawn the hills and trees would rebuild on every drag, so a level field stands in. */
  editing?: boolean;
}

/**
 * Everything around the cars: sky and light, the hills, the road and the
 * circuit's buildings. The Racing lab and the landing page both draw this,
 * so the two always look the same.
 */
export function RacingWorld({ track, tier, focus, editing = false }: Props) {
  const world = useMemo(() => (editing ? null : worldFor(track)), [track, editing]);
  return (
    <>
      <RacingEnvironment tier={tier} focus={focus} />
      {world ? <Terrain world={world} tier={tier} /> : <FlatGround />}
      <TrackMesh track={track} />
      {world && <Forest flora={world.flora} tier={tier} />}
      {world && <Undergrowth flora={world.flora} tufts={world.tufts} tier={tier} />}
      {world && <Stadium world={world} tier={tier} />}
    </>
  );
}

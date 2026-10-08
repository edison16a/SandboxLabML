'use client';

import * as THREE from 'three';
import { useRef } from 'react';
import type { Track } from '@/engine/racing/track/types';
import type { QualityTier } from '@/features/racing/state/labStore';
import { RacingEnvironment } from './RacingEnvironment';
import { Stadium } from './stadium/Stadium';
import { TrackMesh } from './TrackMesh';
import { Forest } from './world/flora/Forest';
import { Undergrowth } from './world/flora/Undergrowth';
import { FlatGround } from './world/terrain/FlatGround';
import { Terrain, TERRAIN_STEP } from './world/terrain/Terrain';
import { useWorld } from './world/useWorld';

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
  // Built in a worker; the level ground and the road show until the hills and trees arrive.
  const world = useWorld(editing ? null : track, TERRAIN_STEP[tier]);
  // Where the sun's shadow box sits this frame: only scenery near it goes through the shadow pass.
  const box = useRef(new THREE.Vector3(1e9, 0, 0));
  return (
    <>
      <RacingEnvironment tier={tier} focus={focus} box={box} />
      {world ? <Terrain world={world} tier={tier} /> : <FlatGround />}
      <TrackMesh track={track} />
      {world && <Forest flora={world.flora} tier={tier} box={box} />}
      {world && <Undergrowth flora={world.flora} tufts={world.tufts} tier={tier} box={box} />}
      {world && <Stadium world={world} tier={tier} />}
    </>
  );
}

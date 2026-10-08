'use client';

import type { QualityTier } from '@/features/racing/state/labStore';
import { barrierOffset } from '../TrackMesh';
import type { WorldData } from '../world/worldData';
import { Dressing } from './Dressing';
import { Fence } from './Fence';
import { Grandstands } from './Grandstands';
import { PitBuilding } from './PitBuilding';

/** The circuit's buildings: grandstands and their fence, the pits, towers, flags and boards. */
export function Stadium({ world, tier }: { world: WorldData; tier: QualityTier }) {
  return (
    <group>
      <Grandstands layout={world.layout} tier={tier} seed={world.shape.seed} />
      <Fence track={world.track} layout={world.layout} offset={barrierOffset(world.track)} />
      <PitBuilding layout={world.layout} />
      <Dressing world={world} />
    </group>
  );
}

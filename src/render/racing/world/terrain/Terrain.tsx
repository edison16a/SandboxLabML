'use client';

import type { QualityTier } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { detailNoise, releaseDetailNoise } from '../detailNoise';
import type { WorldData } from '../worldData';
import { createTerrainMaterial } from './terrainMaterial';
import { buildTerrainGeometry } from './terrainMesh';

/** Fine grid spacing per tier, m. The ground has the most pixels on screen, so Low trades shape detail for speed. */
const STEP = { low: 6, medium: 4, high: 3 } as const;

/**
 * The hills around the circuit. One mesh from the road out to the horizon;
 * it only receives shadows, since its own relief is lit by the sun's angle
 * and would cost a whole extra shadow pass to cast.
 */
export function Terrain({ world, tier }: { world: WorldData; tier: QualityTier }) {
  const geometry = useDisposable(() => buildTerrainGeometry(world.shape, world.flora, STEP[tier]), [world, tier]);
  const look = useDisposable(() => {
    const material = createTerrainMaterial(tier !== 'low', detailNoise());
    return { material, dispose: () => (material.dispose(), releaseDetailNoise()) };
  }, [tier]);
  return <mesh geometry={geometry} material={look.material} receiveShadow={tier !== 'low'} />;
}

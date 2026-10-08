'use client';

import type { QualityTier } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { detailNoise, releaseDetailNoise } from '../detailNoise';
import { useTerrain } from '../useWorld';
import type { WorldData } from '../worldData';
import { FlatGround } from './FlatGround';
import { createTerrainMaterial } from './terrainMaterial';

/** Fine grid spacing per tier, m. The ground has the most pixels on screen, so Low trades shape detail for speed. */
export const TERRAIN_STEP = { low: 6, medium: 4, high: 3 } as const;

/**
 * The hills around the circuit. One mesh from the road out to the horizon,
 * built off the main thread; until it arrives the level ground shows. It
 * only receives shadows, since its own relief is lit by the sun's angle
 * and would cost a whole extra shadow pass to cast.
 */
export function Terrain({ world, tier }: { world: WorldData; tier: QualityTier }) {
  const geometry = useTerrain(world, TERRAIN_STEP[tier]);
  const look = useDisposable(() => {
    const material = createTerrainMaterial(tier !== 'low', detailNoise());
    return { material, dispose: () => (material.dispose(), releaseDetailNoise()) };
  }, [tier]);
  if (!geometry) return <FlatGround />;
  return <mesh geometry={geometry} material={look.material} receiveShadow={tier !== 'low'} />;
}

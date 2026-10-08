'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { QualityTier } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import type { Flora } from './placement';
import { broadleafGeometry, broadleafLodGeometry } from './broadleafGeometry';
import { instanceSet } from './instances';
import { SplitInstances } from './SplitInstances';
import { SHADOW_BOX } from '../lighting/SunLight';
import { PINE_HEIGHT, pineGeometry, pineLodGeometry } from './pineGeometry';
import { createFoliageMaterial } from './foliageMaterial';
import { ATLAS_TILE, foliageAtlas, releaseFoliageAtlas } from './textures/foliageAtlas';

/** Full detail radius per tier, m. Low draws every tree as its simple silhouette. */
const DETAIL_RADIUS = { low: 0, medium: 110, high: 190 } as const;

const PINE_LOOK = { sink: 0.25, stretch: 0.18, from: new THREE.Color(0.8, 0.84, 0.78), to: new THREE.Color(1.1, 1.08, 0.92) };
const BROAD_LOOK = { sink: 0.25, stretch: 0.12, from: new THREE.Color(0.82, 0.86, 0.74), to: new THREE.Color(1.14, 1.1, 0.84) };


/**
 * The trees: tall pines and broadleaf trees, each in two shapes, built
 * from bark limbs and needle or leaf cards and all swaying in one breeze.
 * Geometry is built once per scene and shared by every track.
 */
export function Forest({ flora, tier, box }: { flora: Flora; tier: QualityTier; box: React.RefObject<THREE.Vector3> }) {
  const geo = useDisposable(() => {
    const g = {
      pine: [pineGeometry(0), pineGeometry(1)],
      pineLo: [pineLodGeometry(0), pineLodGeometry(1)],
      broad: [broadleafGeometry(0), broadleafGeometry(1)],
      broadLo: [broadleafLodGeometry(0), broadleafLodGeometry(1)],
    };
    return { ...g, dispose: () => Object.values(g).flat().forEach((x) => x.dispose()) };
  }, []);
  const mats = useDisposable(() => {
    const atlas = foliageAtlas(ATLAS_TILE[tier]);
    // Medium draws with multisampling, which turns the cut out edges into soft coverage.
    const pine = createFoliageMaterial(atlas, PINE_HEIGHT, 0.45, tier === 'medium');
    const broad = createFoliageMaterial(atlas, 8, 0.3, tier === 'medium');
    const all = [pine.material, pine.depth, broad.material, broad.depth];
    return { pine, broad, dispose: () => (all.forEach((m) => m.dispose()), releaseFoliageAtlas()) };
  }, [tier]);
  const sets = useMemo(
    () => ({
      pine: [instanceSet(flora.pines, 0, PINE_LOOK), instanceSet(flora.pines, 1, PINE_LOOK)],
      broad: [instanceSet(flora.broadleaf, 0, BROAD_LOOK), instanceSet(flora.broadleaf, 1, BROAD_LOOK)],
    }),
    [flora],
  );

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    mats.pine.time.value += step;
    mats.broad.time.value += step;
  });

  const radius = DETAIL_RADIUS[tier];
  // A tree can cast into the box from beyond its edge: the box's half diagonal plus a tall pine's shadow in the low sun.
  const shadow = useMemo(() => (tier === 'low' ? null : { at: box, reach: SHADOW_BOX[tier] * 1.42 + 32 }), [tier, box]);
  return (
    <group>
      {[0, 1].map((v) => (
        <SplitInstances key={`p${v}`} set={sets.pine[v]} hi={geo.pine[v]} lo={geo.pineLo[v]} material={mats.pine.material} depth={mats.pine.depth} radius={radius} shadow={shadow} />
      ))}
      {[0, 1].map((v) => (
        <SplitInstances key={`b${v}`} set={sets.broad[v]} hi={geo.broad[v]} lo={geo.broadLo[v]} material={mats.broad.material} depth={mats.broad.depth} radius={radius} shadow={shadow} />
      ))}
    </group>
  );
}

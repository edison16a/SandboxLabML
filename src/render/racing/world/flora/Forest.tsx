'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { QualityTier } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import type { Flora } from './placement';
import { broadleafGeometry, broadleafLodGeometry } from './broadleafGeometry';
import { instanceSet } from './instances';
import { LodTrees } from './LodTrees';
import { PINE_HEIGHT, pineGeometry, pineLodGeometry } from './pineGeometry';
import { detailNoise, releaseDetailNoise } from '../detailNoise';
import { createWindMaterial } from './windMaterial';

/** Full detail radius per tier, m. Low draws every tree as its simple silhouette. */
const DETAIL_RADIUS = { low: 0, medium: 110, high: 190 } as const;

const PINE_LOOK = { sink: 0.25, stretch: 0.18, from: new THREE.Color(0.82, 0.86, 0.8), to: new THREE.Color(1.12, 1.08, 0.94) };
const BROAD_LOOK = { sink: 0.25, stretch: 0.12, from: new THREE.Color(0.85, 0.88, 0.78), to: new THREE.Color(1.18, 1.1, 0.86) };

/**
 * The trees: tall pines and rounder broadleaf trees, each in two shapes,
 * all swaying in one breeze. Geometry is built once per scene and shared by
 * every track.
 */
export function Forest({ flora, tier }: { flora: Flora; tier: QualityTier }) {
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
    const grain = detailNoise();
    const pine = createWindMaterial(PINE_HEIGHT, 0.45, grain);
    const broad = createWindMaterial(8, 0.3, grain);
    return { pine, broad, dispose: () => (pine.material.dispose(), broad.material.dispose(), releaseDetailNoise()) };
  }, []);
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
  const shadow = tier !== 'low';
  return (
    <group>
      {[0, 1].map((v) => (
        <LodTrees key={`p${v}`} set={sets.pine[v]} hi={geo.pine[v]} lo={geo.pineLo[v]} material={mats.pine.material} radius={radius} castShadow={shadow} />
      ))}
      {[0, 1].map((v) => (
        <LodTrees key={`b${v}`} set={sets.broad[v]} hi={geo.broad[v]} lo={geo.broadLo[v]} material={mats.broad.material} radius={radius} castShadow={shadow} />
      ))}
    </group>
  );
}

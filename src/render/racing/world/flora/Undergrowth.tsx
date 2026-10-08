'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { QualityTier } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { withHaze } from '../atmosphere';
import { detailNoise, releaseDetailNoise } from '../detailNoise';
import { shrubGeometry } from './broadleafGeometry';
import { createFoliageMaterial } from './foliageMaterial';
import { createRockMaterial, rockGeometry } from './rocks';
import { instanceSet, withColors, writeInstance, type InstanceSet } from './instances';
import type { Flora } from './placement';
import { ATLAS_TILE, foliageAtlas, releaseFoliageAtlas } from './textures/foliageAtlas';
import { createGrassMaterial } from './grassMaterial';
import { grassTexture } from './textures/grassTexture';
import { tuftGeometry } from './grassGeometry';
import { SplitInstances } from './SplitInstances';
import { SHADOW_BOX } from '../lighting/SunLight';

const SHRUB_LOOK = { sink: 0.15, stretch: 0.2, from: new THREE.Color(0.84, 0.86, 0.76), to: new THREE.Color(1.12, 1.06, 0.86) };
const TUFT_LOOK = { sink: 0.05, stretch: 0.3, from: new THREE.Color(0.82, 0.82, 0.76), to: new THREE.Color(1.15, 1.08, 0.86) };
const ROCK_LOOK = { sink: 0.22, stretch: 0.25, from: new THREE.Color(0.86, 0.84, 0.82), to: new THREE.Color(1.1, 1.04, 0.98) };

/** Static instances that never cast: every item written once when the set changes. */
function Scatter({ set, geometry, material }: { set: InstanceSet; geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    withColors(m, set.count);
    for (let i = 0; i < set.count; i++) writeInstance(m, i, set, i);
    m.count = set.count;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [set]);
  if (!set.count) return null;
  return <instancedMesh key={set.count} ref={ref} args={[geometry, material, set.count]} receiveShadow frustumCulled={false} />;
}

/**
 * Shrubs, boulders and verge grass scattered over the hills. Shrubs and
 * grass sway a little in the same breeze as the trees. Low skips the
 * grass, Medium draws every other tuft. Only shrubs and boulders near the
 * sun's shadow box cast shadows: there are thousands of them, and the box
 * covers a hundred meters or so.
 */
export function Undergrowth({ flora, tufts, tier, box }: { flora: Flora; tufts: Float32Array; tier: QualityTier; box: React.RefObject<THREE.Vector3> }) {
  const geo = useDisposable(() => {
    const detail = tier === 'low' ? 1 : tier === 'medium' ? 2 : 3;
    const g = [shrubGeometry(0), shrubGeometry(1), rockGeometry(0, detail), rockGeometry(1, detail), tuftGeometry()];
    return { shrub: g.slice(0, 2), rock: g.slice(2, 4), tuft: g[4], dispose: () => g.forEach((x) => x.dispose()) };
  }, [tier]);
  const mats = useDisposable(() => {
    const noise = detailNoise();
    const shrub = createFoliageMaterial(foliageAtlas(ATLAS_TILE[tier]), 1.2, 0.05, tier === 'medium');
    const blades = grassTexture(tier === 'high' ? 256 : 128);
    const grass = createGrassMaterial(blades, tier === 'high' ? [38, 70] : [26, 48], tier === 'medium');
    const rock = withHaze(createRockMaterial(noise));
    const all = [shrub.material, shrub.depth, grass.material, rock, blades];
    return { shrub, grass, rock, dispose: () => (all.forEach((m) => m.dispose()), releaseDetailNoise(), releaseFoliageAtlas()) };
  }, [tier]);
  const grass = useMemo(() => (tier === 'low' ? null : instanceSet(tufts, tier === 'high' ? -1 : 0, TUFT_LOOK)), [tufts, tier]);
  const sets = useMemo(
    () => ({
      shrub: [instanceSet(flora.shrubs, 0, SHRUB_LOOK), instanceSet(flora.shrubs, 1, SHRUB_LOOK)],
      rock: [instanceSet(flora.rocks, 0, ROCK_LOOK), instanceSet(flora.rocks, 1, ROCK_LOOK)],
    }),
    [flora],
  );
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    mats.shrub.time.value += step;
    mats.grass.time.value += step;
  });
  // Low shrubs and boulders throw short shadows, so only those just past the box's half diagonal can reach it.
  const shadow = useMemo(() => ({ shrub: tier === 'high' ? { at: box, reach: SHADOW_BOX.high * 1.42 + 4 } : null, rock: tier === 'low' ? null : { at: box, reach: SHADOW_BOX[tier] * 1.42 + 12 } }), [tier, box]);
  return (
    <group>
      {/* Low keeps only one of the two shrub shapes: half the shrubs. */}
      {(tier === 'low' ? [0] : [0, 1]).map((v) => (
        <SplitInstances key={`s${v}`} set={sets.shrub[v]} hi={geo.shrub[v]} lo={geo.shrub[v]} material={mats.shrub.material} depth={mats.shrub.depth} radius={Infinity} shadow={shadow.shrub} />
      ))}
      {grass && <Scatter set={grass} geometry={geo.tuft} material={mats.grass.material} />}
      {[0, 1].map((v) => (
        <SplitInstances key={`r${v}`} set={sets.rock[v]} hi={geo.rock[v]} lo={geo.rock[v]} material={mats.rock} radius={Infinity} shadow={shadow.rock} />
      ))}
    </group>
  );
}

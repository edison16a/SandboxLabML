'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { QualityTier } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { withHaze } from '../atmosphere';
import { detailNoise, releaseDetailNoise } from '../detailNoise';
import { createRockMaterial, rockGeometry, shrubGeometry } from './groundCover';
import { instanceSet, withColors, writeInstance, type InstanceSet } from './instances';
import type { Flora } from './placement';
import { tuftGeometry } from './tufts';
import { createWindMaterial } from './windMaterial';

const SHRUB_LOOK = { sink: 0.15, stretch: 0.2, from: new THREE.Color(0.8, 0.78, 0.62), to: new THREE.Color(1.15, 1.02, 0.7) };
const TUFT_LOOK = { sink: 0.05, stretch: 0.3, from: new THREE.Color(0.82, 0.82, 0.76), to: new THREE.Color(1.15, 1.08, 0.86) };
const ROCK_LOOK = { sink: 0.22, stretch: 0.25, from: new THREE.Color(0.86, 0.84, 0.82), to: new THREE.Color(1.1, 1.04, 0.98) };

/** Static instances: every item written once when the set changes. */
function Scatter({ set, geometry, material, castShadow }: { set: InstanceSet; geometry: THREE.BufferGeometry; material: THREE.Material; castShadow: boolean }) {
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
  return <instancedMesh key={set.count} ref={ref} args={[geometry, material, set.count]} castShadow={castShadow} receiveShadow frustumCulled={false} />;
}

/**
 * Shrubs, boulders and verge grass scattered over the hills. Shrubs and
 * grass sway a little in the same breeze as the trees. Low skips the
 * grass, Medium draws every other tuft.
 */
export function Undergrowth({ flora, tufts, tier }: { flora: Flora; tufts: Float32Array; tier: QualityTier }) {
  const geo = useDisposable(() => {
    const g = [shrubGeometry(0), shrubGeometry(1), rockGeometry(0), rockGeometry(1), tuftGeometry()];
    return { shrub: g.slice(0, 2), rock: g.slice(2, 4), tuft: g[4], dispose: () => g.forEach((x) => x.dispose()) };
  }, []);
  const mats = useDisposable(() => {
    const noise = detailNoise();
    const shrub = createWindMaterial(1.2, 0.05, noise);
    const grass = createWindMaterial(0.7, 0.07);
    const rock = withHaze(createRockMaterial(noise));
    return { shrub, grass, rock, dispose: () => (shrub.material.dispose(), grass.material.dispose(), rock.dispose(), releaseDetailNoise()) };
  }, []);
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
  const shadow = tier === 'high';
  return (
    <group>
      {/* Low keeps only one of the two shrub shapes: half the shrubs. */}
      {(tier === 'low' ? [0] : [0, 1]).map((v) => (
        <Scatter key={`s${v}`} set={sets.shrub[v]} geometry={geo.shrub[v]} material={mats.shrub.material} castShadow={shadow} />
      ))}
      {grass && <Scatter set={grass} geometry={geo.tuft} material={mats.grass.material} castShadow={false} />}
      {[0, 1].map((v) => (
        <Scatter key={`r${v}`} set={sets.rock[v]} geometry={geo.rock[v]} material={mats.rock} castShadow={tier !== 'low'} />
      ))}
    </group>
  );
}

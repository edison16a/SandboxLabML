'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { QualityTier } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { useRacingScene } from '../sceneContext';
import { withHaze } from '../world/atmosphere';
import { brandTexture } from './brandTexture';
import { createCrowdMaterial, seatCrowd, spectatorGeometry } from './crowd';
import { bowlGeometry, roofFront, roofGeometry } from './grandstandGeometry';
import type { Placed, StadiumLayout } from './layout';

/** One stand's crowd: an instanced mesh filled once from precomputed seats. */
function Crowd({ stand, seed, occupancy, geometry, material }: { stand: Placed; seed: number; occupancy: number; geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seats = useMemo(() => seatCrowd(stand.length, seed, occupancy), [stand.length, seed, occupancy]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    (m.instanceMatrix.array as Float32Array).set(seats.matrices);
    m.instanceColor = new THREE.InstancedBufferAttribute(seats.colors.slice(), 3);
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [seats]);
  return <instancedMesh key={seats.count} ref={ref} args={[geometry, material, seats.count]} receiveShadow />;
}

/**
 * Covered grandstands along the outside of the main straight: a stepped
 * concrete bowl with blue seats, a cantilevered roof with the lab's board
 * on its fascia, and a crowd that comes alive when the followed car is near.
 */
export function Grandstands({ layout, tier, seed }: { layout: StadiumLayout; tier: QualityTier; seed: number }) {
  const { frame } = useRacingScene();
  const stands = layout.stands;
  const geo = useDisposable(() => {
    const g = { bowls: stands.map((s) => bowlGeometry(s.length)), roofs: stands.map((s) => roofGeometry(s.length)), fan: spectatorGeometry() };
    return { ...g, dispose: () => [...g.bowls, ...g.roofs, g.fan].forEach((x) => x.dispose()) };
  }, [stands]);
  const look = useDisposable(() => {
    const concrete = withHaze(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, envMapIntensity: 0.8 }));
    const metal = withHaze(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.5, envMapIntensity: 0.9 }));
    const board = brandTexture('dark', 12);
    const fascia = withHaze(new THREE.MeshStandardMaterial({ map: board, roughness: 0.5, emissive: '#ffffff', emissiveMap: board, emissiveIntensity: 0.25 }));
    const crowd = createCrowdMaterial();
    return { concrete, metal, fascia, crowd, dispose: () => [concrete, metal, board, fascia, crowd.material].forEach((x) => x.dispose()) };
  }, []);
  const center = useMemo(() => new THREE.Vector3(layout.x, 0, layout.z), [layout]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    look.crowd.time.value += step;
    // Cheer when the followed car is close and moving: ease in fast, calm down slowly.
    const d = frame.focusPos.distanceTo(center);
    const want = frame.focusSpeed > 5 ? THREE.MathUtils.smoothstep(90, 20, d) : 0;
    const e = look.crowd.excite;
    e.value += (want - e.value) * Math.min(1, step * (want > e.value ? 4 : 0.8));
  });

  const front = roofFront();
  const occupancy = tier === 'low' ? 0.45 : 0.8;
  return (
    <group position={[layout.x, 0, layout.z]} rotation={[0, layout.yaw, 0]}>
      {stands.map((s, k) => (
        // Turned half round on the far side, so the stand's own -z always faces the road.
        <group key={k} position={[s.along, 0, layout.side * s.offset]} rotation={[0, layout.side > 0 ? 0 : Math.PI, 0]}>
          <mesh geometry={geo.bowls[k]} material={look.concrete} castShadow receiveShadow />
          <mesh geometry={geo.roofs[k]} material={look.metal} castShadow receiveShadow />
          <mesh position={[0, front.y, front.z - 0.02]} rotation={[0, Math.PI, 0]} material={look.fascia}>
            <planeGeometry args={[s.length + 1.2, (s.length + 1.2) / 12]} />
          </mesh>
          <Crowd stand={s} seed={seed + k * 101} occupancy={occupancy} geometry={geo.fan} material={look.crowd.material} />
        </group>
      ))}
    </group>
  );
}

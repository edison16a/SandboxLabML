'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DEFAULT_CAR } from '@/engine/racing/car/params';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { blendPose, type Pose } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { crowdGeometry } from './car/geometry/crowd';
import { withCarSurface } from './car/materials/carSurface';
import { useCarReflections } from './car/materials/useCarReflections';
import { withNearFade } from './fleet/nearFade';
import { FleetMotion } from './motion/fleetMotion';
import { CRASHED_COLOR, speciesColor } from './palette';
import { useRacingScene } from './sceneContext';

const MAX_CARS = 256;
const STRIDE = RACING_SNAPSHOT.stride;

/**
 * The live generation, up to 256 cars in a single instanced draw call,
 * each a lighter build of the hero car. The paint takes the species color;
 * stopped cars turn graphite and sink slightly so the ones still driving
 * stand out. Every body pitches, rolls and slides on its own springs from
 * its own accelerations, and cars right in front of the chase camera
 * dissolve so they never block the one it follows.
 */
export function PopulationCars({ castShadow }: { castShadow: boolean }) {
  const { population, frame } = useRacingScene();
  const tier = useRacingLab((s) => s.activeTier);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => crowdGeometry(), []);
  const fade = useMemo(() => ({ value: 0 }), []);
  // High adds a clear coat over the paint and glass; the lower tiers keep the cheaper standard shading.
  const material = useDisposable(
    () => withNearFade(withCarSurface(tier === 'high' ? new THREE.MeshPhysicalMaterial({ vertexColors: true, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.85 }) : new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: 0.85 })), fade),
    [tier],
  );
  useCarReflections([material]);
  const fleet = useMemo(() => new FleetMotion(MAX_CARS), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), pose: { x: 0, y: 0, heading: 0 } as Pose }), []);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const { view, camera, run } = useRacingLab.getState();
    fade.value = camera === 'chase' ? 1 : 0;
    if (!population?.curr || view === 'overlay') {
      m.count = 0;
      return;
    }
    const buf = population.curr.buffer;
    const prev = population.prev?.buffer ?? null;
    const a = population.alpha();
    const n = Math.min(population.count, MAX_CARS);
    fleet.update(population, n, run?.racing?.car ?? DEFAULT_CAR, Math.min(dt, 0.1));
    for (let i = 0; i < n; i++) {
      blendPose(prev, buf, i * STRIDE, a, tmp.pose);
      const status = buf[i * STRIDE + 6];
      fleet.compose(i, tmp.pose.x, status === 0 ? 0 : -0.06, -tmp.pose.y, tmp.pose.heading, i === frame.hiddenPopulation ? 0 : 1, tmp.m);
      m.setMatrixAt(i, tmp.m);
      if (status === 0) speciesColor(population.tags[i] ?? 0, tmp.c);
      else tmp.c.copy(CRASHED_COLOR);
      m.setColorAt(i, tmp.c);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, MAX_CARS]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) useRacingLab.getState().set({ focus: { kind: 'car', index: e.instanceId } });
      }}
    />
  );
}

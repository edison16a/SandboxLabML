'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { blendPose, type Pose } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { crowdGeometry } from './car/geometry/crowd';
import { withCarSurface } from './car/materials/carSurface';
import { useCarReflections } from './car/materials/useCarReflections';
import { CRASHED_COLOR, speciesColor } from './palette';
import { useRacingScene } from './sceneContext';

const MAX_CARS = 256;
const STRIDE = RACING_SNAPSHOT.stride;

/**
 * The live generation, up to 256 cars in a single instanced draw call,
 * each a lighter build of the hero car. The paint takes the species color;
 * stopped cars turn graphite and sink slightly so the ones still driving
 * stand out.
 */
export function PopulationCars({ castShadow }: { castShadow: boolean }) {
  const { population, frame } = useRacingScene();
  const tier = useRacingLab((s) => s.activeTier);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => crowdGeometry(), []);
  // High adds a clear coat over the paint and glass; the lower tiers keep the cheaper standard shading.
  const material = useDisposable(
    () => withCarSurface(tier === 'high' ? new THREE.MeshPhysicalMaterial({ vertexColors: true, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.85 }) : new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: 0.85 })),
    [tier],
  );
  useCarReflections([material]);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color(), up: new THREE.Vector3(0, 1, 0), pose: { x: 0, y: 0, heading: 0 } as Pose }),
    [],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const view = useRacingLab.getState().view;
    if (!population?.curr || view === 'overlay') {
      m.count = 0;
      return;
    }
    const buf = population.curr.buffer;
    const prev = population.prev?.buffer ?? null;
    const a = population.alpha();
    const n = Math.min(population.count, MAX_CARS);
    for (let i = 0; i < n; i++) {
      blendPose(prev, buf, i * STRIDE, a, tmp.pose);
      const status = buf[i * STRIDE + 6];
      const hidden = i === frame.hiddenPopulation;
      tmp.q.setFromAxisAngle(tmp.up, tmp.pose.heading);
      tmp.p.set(tmp.pose.x, status === 0 ? 0 : -0.06, -tmp.pose.y);
      tmp.s.setScalar(hidden ? 0 : 1);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
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

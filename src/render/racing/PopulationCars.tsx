'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { blendPose, type Pose } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { mergedCarGeometry } from './carGeometry';
import { CRASHED_COLOR, speciesColor } from './palette';
import { useRacingScene } from './sceneContext';

const MAX_CARS = 256;
const STRIDE = RACING_SNAPSHOT.stride;

/**
 * The live generation, up to 256 cars in a single instanced draw call.
 * Cars are colored by species; stopped cars turn graphite and sink slightly
 * so the ones still driving stand out.
 */
export function PopulationCars({ castShadow }: { castShadow: boolean }) {
  const { population, frame } = useRacingScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => mergedCarGeometry(), []);
  const material = useDisposable(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.35, envMapIntensity: 1.1 }),
    [],
  );
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

'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { FLAG_FROZEN, FLAG_SEEING } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, blendFloorPose, hasFlag } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { HS } from '../palette';
import { fanGeometry } from './gridGeometry';
import { commit, makeScratch, MAX_ARENAS, placeInstance, GRID_LAYER } from './scratch';

/**
 * On the grid a cone only has to say where the seeker looks, so it is a
 * short fan that never reaches the next arena, not the full vision range.
 */
const CONE_RADIUS = 5.5;

/**
 * Seeker vision cones for the grid, one instanced draw call. Additive
 * blending lets the instance color act as brightness: off during prep,
 * dim while searching, bright once the hider is in sight.
 */
export function GridCones() {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => fanGeometry(CONE_RADIUS, DEFAULT_HIDESEEK_PHYSICS.vision.fov, 18), []);
  const material = useDisposable(
    () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    [],
  );
  const t = useMemo(() => makeScratch(), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const curr = frame.curr;
    if (!curr || frame.count <= 1) return commit(m, 0);
    for (let k = 0; k < frame.count; k++) {
      const arena = frame.first + k;
      const o = agentAt(arena, 1);
      const flags = curr[o + 3];
      arenaOrigin(k, frame.lattice, t.o);
      blendFloorPose(frame.prev, curr, o, frame.alpha, t.pose);
      const off = k === frame.focusSlot || hasFlag(flags, FLAG_FROZEN) ? 0 : 1;
      placeInstance(m, k, t, t.o.x + t.pose.x, 0.04, t.o.z + t.pose.z, t.pose.yaw, off, 1, off);
      const brightness = hasFlag(flags, FLAG_SEEING) ? 1 : 0.38;
      m.setColorAt(k, t.c.copy(HS.seeker).multiplyScalar(brightness * (k === frame.focusSlot ? 1 : frame.dim)));
    }
    commit(m, frame.count);
  });

  return <instancedMesh layers={GRID_LAYER} ref={mesh} args={[geometry, material, MAX_ARENAS]} frustumCulled={false} renderOrder={3} raycast={() => null} />;
}

'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BOX_COUNT, boxSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, blendFloorPose, boxAt } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { blobTexture, floorQuad } from './gridGeometry';
import { commit, makeScratch, MAX_ARENAS, placeInstance, GRID_LAYER } from './scratch';

const PER_ARENA = 2 + BOX_COUNT;
const SIZES = Array.from({ length: BOX_COUNT }, (_, i) => boxSize(DEFAULT_HIDESEEK_PHYSICS, i));
const AGENT_BLOB = DEFAULT_HIDESEEK_PHYSICS.agent.radius * 3.2;

/**
 * Soft blob shadows under every agent and box of the grid, one instanced
 * draw call of textured quads. The grid has no shadow maps, and these are
 * what keep its objects from floating.
 */
export function GridShadows() {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => floorQuad(1), []);
  const built = useDisposable(() => {
    const alphaMap = blobTexture();
    const material = new THREE.MeshBasicMaterial({ color: '#1d1a15', alphaMap, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return { material, dispose: () => (alphaMap.dispose(), material.dispose()) };
  }, []);
  const t = useMemo(() => makeScratch(), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const curr = frame.curr;
    if (!curr || frame.count <= 1) return commit(m, 0);
    let n = 0;
    for (let k = 0; k < frame.count; k++) {
      const arena = frame.first + k;
      arenaOrigin(k, frame.lattice, t.o);
      const hide = k === frame.focusSlot ? 0 : 1;
      for (let a = 0; a < 2; a++) {
        blendFloorPose(frame.prev, curr, agentAt(arena, a), frame.alpha, t.pose);
        placeInstance(m, n++, t, t.o.x + t.pose.x, 0.012, t.o.z + t.pose.z, 0, AGENT_BLOB * hide, 1, AGENT_BLOB * hide);
      }
      for (let b = 0; b < BOX_COUNT; b++) {
        blendFloorPose(frame.prev, curr, boxAt(arena, b), frame.alpha, t.pose);
        const s = SIZES[b];
        placeInstance(m, n++, t, t.o.x + t.pose.x, 0.011, t.o.z + t.pose.z, t.pose.yaw, (s.length + 0.9) * hide, 1, (s.width + 0.9) * hide);
      }
    }
    commit(m, n);
  });

  return <instancedMesh layers={GRID_LAYER} ref={mesh} args={[geometry, built.material, MAX_ARENAS * PER_ARENA]} frustumCulled={false} renderOrder={1} raycast={() => null} />;
}

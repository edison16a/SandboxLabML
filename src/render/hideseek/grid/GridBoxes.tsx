'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BOX_COUNT, boxSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { blendFloorPose, boxAt } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { HS } from '../palette';
import { standingUnitBox } from './gridGeometry';
import { commit, makeScratch, MAX_ARENAS, placeInstance, GRID_LAYER } from './scratch';

const SIZES = Array.from({ length: BOX_COUNT }, (_, i) => boxSize(DEFAULT_HIDESEEK_PHYSICS, i));

/**
 * Every box of every grid arena in one instanced draw call. A locked box is
 * a per-instance color (amber), which is all the grid needs to show a fort.
 */
export function GridBoxes({ onPick }: { onPick: (slot: number) => void }) {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => standingUnitBox(), []);
  const material = useDisposable(() => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 }), []);
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
      const dim = k === frame.focusSlot ? 1 : frame.dim;
      for (let b = 0; b < BOX_COUNT; b++) {
        const o = boxAt(arena, b);
        blendFloorPose(frame.prev, curr, o, frame.alpha, t.pose);
        const size = SIZES[b];
        placeInstance(m, n, t, t.o.x + t.pose.x, 0, t.o.z + t.pose.z, t.pose.yaw, size.length * hide, size.height * hide, size.width * hide);
        const base = curr[o + 3] === 1 ? HS.locked : b < 2 ? HS.cube : HS.plank;
        m.setColorAt(n++, t.c.copy(base).multiplyScalar(dim));
      }
    }
    commit(m, n);
  });

  return (
    <instancedMesh layers={GRID_LAYER}
      ref={mesh}
      args={[geometry, material, MAX_ARENAS * BOX_COUNT]}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onPick(Math.floor(e.instanceId / BOX_COUNT));
      }}
    />
  );
}

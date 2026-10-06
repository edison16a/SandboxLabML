'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { arenaOrigin } from '../layout/gridLattice';
import { balanceColor } from '../palette';
import type { ArenaBalance } from './arenaBalance';
import { borderGeometry } from './gridGeometry';
import { commit, makeScratch, MAX_ARENAS, placeInstance, GRID_LAYER } from './scratch';

/**
 * A thin frame around each grid arena tinted by who is ahead this match:
 * blue while the hider has stayed hidden longer than seen, red the other
 * way round. One instanced draw call; also feeds the balance tracker.
 */
export function GridBorders({ balance }: { balance: ArenaBalance }) {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => borderGeometry(), []);
  const material = useDisposable(() => new THREE.MeshBasicMaterial({ toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), []);
  const t = useMemo(() => makeScratch(), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const curr = frame.curr;
    if (!curr) return commit(m, 0);
    balance.update(curr, frame.first, frame.count, frame.epoch);
    if (frame.count <= 1) return commit(m, 0);
    for (let k = 0; k < frame.count; k++) {
      arenaOrigin(k, frame.lattice, t.o);
      placeInstance(m, k, t, t.o.x, 0.006, t.o.z, 0, 1, 1, 1);
      balanceColor(balance.balance(k), t.c);
      m.setColorAt(k, t.c.multiplyScalar(k === frame.focusSlot ? 1 : frame.dim * 0.9));
    }
    commit(m, frame.count);
  });

  return <instancedMesh layers={GRID_LAYER} ref={mesh} args={[geometry, material, MAX_ARENAS]} frustumCulled={false} raycast={() => null} />;
}

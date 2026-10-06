'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { arenaOrigin, ARENA_SPAN } from '../layout/gridLattice';
import { MAX_WALLS_PER_ARENA, wallsOfLayout } from '../layout/arenaWalls';
import { HS } from '../palette';
import { floorQuad, standingUnitBox } from '../shared/basicGeometry';
import { commit, makeScratch, MAX_ARENAS, placeInstance, GRID_LAYER } from './scratch';

const WALL_HEIGHT = DEFAULT_HIDESEEK_PHYSICS.arena.wallHeight;

interface Props {
  onPick: (slot: number) => void;
}

/**
 * Floors and walls of every grid arena, two instanced draw calls. They only
 * move when the lattice, the layouts or the focus change, so they are
 * rebuilt on the frame version rather than every frame.
 */
export function GridWalls({ onPick }: Props) {
  const { frame } = useHsScene();
  const floors = useRef<THREE.InstancedMesh>(null);
  const walls = useRef<THREE.InstancedMesh>(null);
  const floorGeo = useDisposable(() => floorQuad(ARENA_SPAN), []);
  const wallGeo = useDisposable(() => standingUnitBox(), []);
  const floorMat = useDisposable(() => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }), []);
  const wallMat = useDisposable(() => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 }), []);
  const t = useMemo(() => makeScratch(), []);
  const wallSlot = useMemo(() => new Int16Array(MAX_ARENAS * MAX_WALLS_PER_ARENA), []);

  useFrame(() => {
    const f = floors.current;
    const w = walls.current;
    if (!f || !w || t.version === frame.version) return;
    t.version = frame.version;
    const grid = frame.count > 1;
    let n = 0;
    for (let k = 0; grid && k < frame.count; k++) {
      arenaOrigin(k, frame.lattice, t.o);
      const hide = k === frame.focusSlot ? 0 : 1;
      const dim = k === frame.focusSlot ? 1 : frame.dim;
      placeInstance(f, k, t, t.o.x, 0, t.o.z, 0, hide, 1, hide);
      f.setColorAt(k, t.c.copy(HS.gridFloor).multiplyScalar(dim));
      for (const r of wallsOfLayout(frame.layouts[k] ?? 0)) {
        placeInstance(w, n, t, t.o.x + r.x, 0, t.o.z + r.z, 0, r.hx * 2 * hide, WALL_HEIGHT * hide, r.hz * 2 * hide);
        w.setColorAt(n, t.c.copy(HS.gridWall).multiplyScalar(dim));
        wallSlot[n++] = k;
      }
    }
    commit(f, grid ? frame.count : 0);
    commit(w, n);
  });

  return (
    <group>
      <instancedMesh layers={GRID_LAYER}
        ref={floors}
        args={[floorGeo, floorMat, MAX_ARENAS]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) onPick(e.instanceId);
        }}
      />
      <instancedMesh layers={GRID_LAYER}
        ref={walls}
        args={[wallGeo, wallMat, MAX_ARENAS * MAX_WALLS_PER_ARENA]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) onPick(wallSlot[e.instanceId]);
        }}
      />
    </group>
  );
}

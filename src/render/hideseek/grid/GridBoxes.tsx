'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BOX_KINDS, boxSize, DEFAULT_HIDESEEK_PHYSICS, type BoxKind } from '@/engine/hideseek/physics';
import { useDisposable } from '@/render/shared/useDisposable';
import { BOX_LOOK } from '../boxes/boxMaterials';
import { instancedCrateGeometry } from '../boxes/instancedCrate';
import { useHsScene } from '../frame/sceneContext';
import { blendFloorPose, boxAt } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { commit, GRID_LAYER, makeScratch, MAX_ARENAS, placeInstance } from './scratch';
import { tintMaskMaterial } from '../shared/tintMask';

const BRACE = new THREE.Color(BOX_LOOK.brace);
/** Pushed past 1 so a locked crate's braces read as lit even from far away. */
const LOCKED = new THREE.Color(BOX_LOOK.lockGlow).multiplyScalar(1.5);
/** Box indexes of each kind: two cubes, then two planks. */
const OF_KIND: Record<BoxKind, number[]> = { cube: [], plank: [] };
BOX_KINDS.forEach((k, i) => OF_KIND[k].push(i));

/**
 * Every crate of every grid arena, one instanced draw call per kind: the
 * cubes, then the planks. Locked crates light their braces in the hider
 * color, which is all the grid needs to show a fort.
 */
export function GridBoxes({ onPick }: { onPick: (slot: number) => void }) {
  return (
    <group>
      <CrateKind kind="cube" onPick={onPick} />
      <CrateKind kind="plank" onPick={onPick} />
    </group>
  );
}

function CrateKind({ kind, onPick }: { kind: BoxKind; onPick: (slot: number) => void }) {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const boxes = OF_KIND[kind];
  const geometry = useDisposable(() => instancedCrateGeometry(kind, boxSize(DEFAULT_HIDESEEK_PHYSICS, boxes[0])), [kind, boxes]);
  const material = useDisposable(() => tintMaskMaterial({ roughness: 0.45, metalness: 0.15, envMapIntensity: 1 }), []);
  const t = useMemo(() => makeScratch(), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const curr = frame.curr;
    if (!curr || frame.count <= 1) return commit(m, 0);
    material.color.setScalar(frame.dim);
    let n = 0;
    for (let k = 0; k < frame.count; k++) {
      const arena = frame.first + k;
      arenaOrigin(k, frame.lattice, t.o);
      const hide = k === frame.focusSlot ? 0 : 1;
      for (const b of boxes) {
        const o = boxAt(arena, b);
        blendFloorPose(frame.prev, curr, o, frame.alpha, t.pose);
        placeInstance(m, n, t, t.o.x + t.pose.x, 0, t.o.z + t.pose.z, t.pose.yaw, hide, hide, hide);
        m.setColorAt(n++, curr[o + 3] === 1 ? LOCKED : BRACE);
      }
    }
    commit(m, n);
  });

  return (
    <instancedMesh
      layers={GRID_LAYER}
      ref={mesh}
      args={[geometry, material, MAX_ARENAS * boxes.length]}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onPick(Math.floor(e.instanceId / boxes.length));
      }}
    />
  );
}

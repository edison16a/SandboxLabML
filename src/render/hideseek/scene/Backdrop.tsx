'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { standingUnitBox } from '../grid/gridGeometry';
import { commit, makeScratch, placeInstance } from '../grid/scratch';
import { HS_COLORS } from '../palette';
import { backdropBlocks, distanceToClear, heightRamp } from './backdropBlocks';

/** Open ground kept round the arenas before the first blocks, m. */
const MARGIN = 5;
/** How far out from the arenas blocks still stand, m. Beyond, the haze has taken them anyway. */
const REACH = 120;
const LIGHT = new THREE.Color('#f1f1ef');
const DARK = new THREE.Color('#dcdcd9');

/**
 * The world beyond the arenas: open pale stone ground and, round it, a
 * quiet city of pale plaster blocks that stay low near the arenas and rise
 * into a skyline further out, fading into the haze. One instanced draw
 * call; the blocks are re-placed only when the arena grid changes size.
 */
export function Backdrop() {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const blocks = useMemo(() => backdropBlocks(), []);
  const geometry = useDisposable(() => standingUnitBox(), []);
  const blockMat = useDisposable(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, envMapIntensity: 0.7 }), []);
  const groundMat = useDisposable(() => new THREE.MeshStandardMaterial({ color: HS_COLORS.ground, roughness: 0.95, metalness: 0, envMapIntensity: 0.5 }), []);
  const t = useMemo(() => ({ ...makeScratch(), w: -1, d: -1 }), []);

  useFrame(() => {
    const m = mesh.current;
    const { width, depth } = frame.lattice;
    if (!m || (t.w === width && t.d === depth)) return;
    t.w = width;
    t.d = depth;
    const hx = width / 2 + MARGIN;
    const hz = depth / 2 + MARGIN;
    let n = 0;
    for (const b of blocks) {
      const gap = distanceToClear(b.x, b.z, hx, hz) - Math.max(b.w, b.d) / 2;
      if (gap < 0 || gap > REACH) continue;
      placeInstance(m, n, t, b.x, 0, b.z, 0, b.w, b.h * heightRamp(gap), b.d);
      m.setColorAt(n++, t.c.copy(LIGHT).lerp(DARK, b.tone));
    }
    commit(m, n);
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow material={groundMat} raycast={() => null}>
        <planeGeometry args={[3000, 3000]} />
      </mesh>
      <instancedMesh ref={mesh} args={[geometry, blockMat, blocks.length]} frustumCulled={false} castShadow receiveShadow raycast={() => null} />
    </group>
  );
}

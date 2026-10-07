'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { BACKDROP_LAYER, commit, makeScratch, placeInstance } from '../grid/scratch';
import { HS_COLORS } from '../palette';
import { groundedMaterial } from '../room/groundedMaterial';
import { openUnitBox } from '../shared/basicGeometry';
import { cityBase, cityBlocks } from './backdropBlocks';

/** Most blocks the city ever holds; cityBlocks stops there. */
const CAPACITY = 8000;
const LIGHT = new THREE.Color(HS_COLORS.blockLight);
const DARK = new THREE.Color(HS_COLORS.blockDark);

/**
 * The world beyond the arenas: a dense city of grey blocks of many heights
 * packed round the arenas, low by the walls and rising into a skyline that
 * fades into the haze, on open ground. One instanced draw call; the blocks
 * are rebuilt only when the arena grid changes size.
 */
export function Backdrop({ shade = 1 }: { /** Brightness of the blocks, 1 in the lab. The landing page darkens only the city, so its headline sits on a dark field while the room keeps its color. */ shade?: number }) {
  const { frame } = useHsScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => openUnitBox(), []);
  const blockMat = useDisposable(() => groundedMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0, envMapIntensity: 0.6 }, 0.62, 1.4), []);
  const groundMat = useDisposable(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(HS_COLORS.ground).multiplyScalar(shade), roughness: 0.9, metalness: 0, envMapIntensity: 0.4 }), [shade]);
  const t = useMemo(() => ({ ...makeScratch(), w: -1, d: -1, n: -1, light: LIGHT.clone().multiplyScalar(shade), dark: DARK.clone().multiplyScalar(shade) }), [shade]);
  const camera = useThree((s) => s.camera);
  useEffect(() => void camera.layers.enable(BACKDROP_LAYER), [camera]);

  useFrame(() => {
    const m = mesh.current;
    const { width, depth, count } = frame.lattice;
    if (!m || (t.w === width && t.d === depth && t.n === count)) return;
    t.w = width;
    t.d = depth;
    t.n = count;
    const blocks = cityBlocks(width / 2, depth / 2, cityBase(count), CAPACITY);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      placeInstance(m, i, t, b.x, 0, b.z, 0, b.w, b.h, b.d);
      m.setColorAt(i, t.c.copy(t.light).lerp(t.dark, b.tone));
    }
    commit(m, blocks.length);
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow material={groundMat} raycast={() => null}>
        <planeGeometry args={[3000, 3000]} />
      </mesh>
      <instancedMesh layers={BACKDROP_LAYER} ref={mesh} args={[geometry, blockMat, CAPACITY]} frustumCulled={false} raycast={() => null} />
    </group>
  );
}

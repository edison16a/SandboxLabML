'use client';

import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Course } from '@/engine/navigation/course/build';
import { OUTER_WALL, WALL_HEIGHT } from '@/engine/navigation/course/types';
import { commit, makeScratch, placeInstance } from '@/render/navigation/frame/instancing';
import { groundedMaterial } from '@/render/navigation/room/groundedMaterial';
import { cityBlocks } from '@/render/navigation/scene/backdropBlocks';
import { openUnitBox } from '@/render/navigation/scene/basicGeometry';
import { useDisposable } from '@/render/shared/useDisposable';
import { NAV_COLORS } from '../palette';

/** Most blocks the city ever holds. */
const CAPACITY = 8000;
/** The finest block size next to the course, m. */
const BASE = 2;
/** Blocks this close to the outer walls stay under them, m, so they never hide the course. */
const NEAR = 3;
const LIGHT = new THREE.Color(NAV_COLORS.blockLight);
const DARK = new THREE.Color(NAV_COLORS.blockDark);

/**
 * The world round the course: a dense grey block city, low by the walls
 * and rising into a skyline that fades into the haze, on open ground. One
 * instanced draw call, rebuilt only when the course size changes.
 */
export function NavBackdrop({ course }: { course: Course | null }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => openUnitBox(), []);
  const blockMat = useDisposable(() => groundedMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0, envMapIntensity: 0.6 }, 0.62, 1.4), []);
  const groundMat = useDisposable(() => new THREE.MeshStandardMaterial({ color: NAV_COLORS.ground, roughness: 0.9, metalness: 0, envMapIntensity: 0.4 }), []);
  const t = useMemo(() => makeScratch(), []);
  const hx = (course?.halfLength ?? 15) + OUTER_WALL;
  const hz = (course?.halfWidth ?? 7) + OUTER_WALL;

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const blocks = cityBlocks(hx, hz, BASE, CAPACITY);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const gap = Math.hypot(Math.max(0, Math.abs(b.x) - b.w / 2 - hx), Math.max(0, Math.abs(b.z) - b.d / 2 - hz));
      const h = gap < NEAR ? Math.min(b.h, WALL_HEIGHT - 0.3) : b.h;
      placeInstance(m, i, t, b.x, 0, b.z, 0, b.w, h, b.d);
      m.setColorAt(i, t.c.copy(LIGHT).lerp(DARK, b.tone));
    }
    commit(m, blocks.length);
  }, [hx, hz, t]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow material={groundMat} raycast={() => null}>
        <planeGeometry args={[3000, 3000]} />
      </mesh>
      <instancedMesh ref={mesh} args={[geometry, blockMat, CAPACITY]} frustumCulled={false} raycast={() => null} />
    </group>
  );
}

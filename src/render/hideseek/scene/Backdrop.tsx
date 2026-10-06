'use client';

import * as THREE from 'three';
import { useDisposable } from '@/render/shared/useDisposable';
import { HS_COLORS } from '../palette';

/**
 * The floor of the hall the arenas stand in: a dark, slightly rough plane
 * that fades into the fog. It takes the showcase's shadows too, so an arena
 * near the edge of the grid still grounds its walls.
 */
export function Backdrop() {
  const material = useDisposable(() => new THREE.MeshStandardMaterial({ color: HS_COLORS.ground, roughness: 1, metalness: 0, envMapIntensity: 0.2 }), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow material={material} raycast={() => null}>
      <planeGeometry args={[3000, 3000]} />
    </mesh>
  );
}

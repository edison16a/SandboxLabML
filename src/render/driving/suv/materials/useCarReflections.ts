'use client';

import type * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

type Reflective = THREE.MeshStandardMaterial;

/**
 * Gives car materials their own reflection strength. three applies the
 * scene's dim environment intensity to any material without an envMap of
 * its own, which flattens paint and glass. Handing the scene's environment
 * map to these materials directly lets each one keep its envMapIntensity.
 * The map arrives a frame or two after mount, so this checks every frame.
 */
export function useCarReflections(materials: Iterable<THREE.Material>): void {
  useFrame(({ scene }) => {
    const env = scene.environment;
    if (!env) return;
    for (const m of materials) {
      const r = m as Reflective;
      if (!r.isMeshStandardMaterial || r.envMap === env) continue;
      r.envMap = env;
      r.needsUpdate = true;
    }
  });
}

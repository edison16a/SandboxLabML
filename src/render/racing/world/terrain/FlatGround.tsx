'use client';

import * as THREE from 'three';
import { useDisposable } from '@/render/shared/useDisposable';
import { withHaze } from '../atmosphere';
import { GROUND_LEVEL } from './terrainHeight';

/**
 * A level field of mown verge grass, shown while a track is being drawn.
 * Building the hills takes a moment, too long to redo on every drag, and
 * the editor looks straight down anyway.
 */
export function FlatGround() {
  const built = useDisposable(() => {
    const geometry = new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2);
    const material = withHaze(new THREE.MeshLambertMaterial({ color: '#8c9450' }));
    return { geometry, material, dispose: () => (geometry.dispose(), material.dispose()) };
  }, []);
  return <mesh geometry={built.geometry} material={built.material} position-y={GROUND_LEVEL} receiveShadow />;
}

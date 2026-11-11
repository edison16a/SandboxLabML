'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useDisposable } from '@/render/shared/useDisposable';
import { createSkyMaterial } from './skyMaterial';

interface Props {
  /** Cloud detail: 6 octaves on High, fewer on cheaper tiers. */
  octaves: number;
  /** Follow the camera, for the visible sky. The copy baked into the environment map stays put. */
  follow?: boolean;
  radius?: number;
}

/**
 * A sphere drawn first, behind everything, that carries the sky shader.
 * It rides along with the camera so the horizon never comes closer.
 */
export function SkyDome({ octaves, follow = true, radius = 4000 }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const built = useDisposable(() => {
    const geometry = new THREE.SphereGeometry(radius, 48, 24);
    const material = createSkyMaterial(octaves);
    return { geometry, material, dispose: () => (geometry.dispose(), material.dispose()) };
  }, [octaves, radius]);

  useFrame(({ camera }, dt) => {
    built.material.uniforms.uTime.value += Math.min(dt, 0.1);
    if (follow) mesh.current?.position.copy(camera.position);
  });

  return <mesh ref={mesh} geometry={built.geometry} material={built.material} renderOrder={-1000} frustumCulled={false} />;
}

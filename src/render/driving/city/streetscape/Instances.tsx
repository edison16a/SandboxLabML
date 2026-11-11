'use client';

import * as THREE from 'three';
import { useLayoutEffect, useRef } from 'react';

interface Props {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  /** A shift in each instance's own frame, for parts that sit on another part (a lamp on its housing). */
  offset?: [number, number, number];
  shadows?: boolean;
  /** Give the mesh per instance colors, for parts whose color changes at run time. */
  colored?: boolean;
  meshRef?: (mesh: THREE.InstancedMesh | null) => void;
}

/**
 * Static street furniture as one instanced draw call: the matrices are
 * written once when the city is built and never touched again, so a
 * thousand poles cost one call and no per frame work.
 */
export function Instances({ geometry, material, matrices, offset, shadows = false, colored = false, meshRef }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const shift = offset ? new THREE.Matrix4().makeTranslation(offset[0], offset[1], offset[2]) : null;
    const tmp = new THREE.Matrix4();
    matrices.forEach((mat, i) => m.setMatrixAt(i, shift ? tmp.multiplyMatrices(mat, shift) : mat));
    if (colored) for (let i = 0; i < matrices.length; i++) m.setColorAt(i, new THREE.Color(0, 0, 0));
    m.count = matrices.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [matrices, offset, colored]);
  return (
    <instancedMesh
      ref={(el) => {
        mesh.current = el;
        meshRef?.(el);
      }}
      args={[geometry, material, Math.max(1, matrices.length)]}
      castShadow={shadows}
      receiveShadow
    />
  );
}

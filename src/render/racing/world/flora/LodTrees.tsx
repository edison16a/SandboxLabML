'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { withColors, writeInstance, type InstanceSet } from './instances';

interface Props {
  set: InstanceSet;
  hi: THREE.BufferGeometry;
  lo: THREE.BufferGeometry;
  material: THREE.Material;
  /** Within this many meters of the camera a tree draws in full detail, m. Zero keeps every tree simple. */
  radius: number;
  castShadow: boolean;
}

/** How far the camera has to move before trees swap detail levels again, m. */
const RESORT = 6;

/**
 * One kind of tree in two instanced meshes: full detail near the camera and
 * the cheap silhouette further out. The split is redone only after the
 * camera has moved a few meters, by copying precomputed matrices, so it
 * costs a short loop now and then and allocates nothing.
 */
export function LodTrees({ set, hi, lo, material, radius, castShadow }: Props) {
  const near = useRef<THREE.InstancedMesh>(null);
  const far = useRef<THREE.InstancedMesh>(null);
  const last = useMemo(() => new THREE.Vector3(1e9, 0, 0), []);
  // New trees or a new detail radius: forget the last split so the next frame redoes it.
  useEffect(() => void last.set(1e9, 0, 0), [set, radius, last]);

  useFrame(({ camera }) => {
    const a = near.current;
    const b = far.current;
    if (!a || !b || camera.position.distanceToSquared(last) < RESORT * RESORT) return;
    last.copy(camera.position);
    withColors(a, set.count);
    withColors(b, set.count);
    const r2 = radius * radius;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < set.count; i++) {
      const dx = set.at[i * 3] - camera.position.x;
      const dy = set.at[i * 3 + 1] - camera.position.y;
      const dz = set.at[i * 3 + 2] - camera.position.z;
      if (dx * dx + dy * dy + dz * dz < r2) writeInstance(a, na++, set, i);
      else writeInstance(b, nb++, set, i);
    }
    a.count = na;
    b.count = nb;
    a.instanceMatrix.needsUpdate = b.instanceMatrix.needsUpdate = true;
    if (a.instanceColor) a.instanceColor.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  });

  if (!set.count) return null;
  return (
    <>
      <instancedMesh ref={near} args={[hi, material, set.count]} count={0} castShadow={castShadow} receiveShadow frustumCulled={false} />
      <instancedMesh ref={far} args={[lo, material, set.count]} count={0} receiveShadow={castShadow} frustumCulled={false} />
    </>
  );
}

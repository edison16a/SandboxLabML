'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { withColors, writeInstance, type InstanceSet } from './instances';

interface Props {
  set: InstanceSet;
  /** Full detail shape near the camera, and the cheap one beyond `radius`. Pass the same geometry twice for one shape. */
  hi: THREE.BufferGeometry;
  lo: THREE.BufferGeometry;
  material: THREE.Material;
  /** The shadow pass's material, carrying the same wind and card layout. */
  depth?: THREE.Material;
  /** Within this many meters of the camera an item draws in full detail. Zero keeps every item simple. */
  radius: number;
  /** Where the sun's shadow box is, and how far from it an item may still cast into it; null casts no shadows. */
  shadow: { at: React.RefObject<THREE.Vector3>; reach: number } | null;
}

/** How far the camera or the shadow box has to move before items are split again, m. */
const RESORT = 6;

/** Flags a mesh's instance buffers for upload after a split. */
function touch(m: THREE.InstancedMesh): void {
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

/**
 * One kind of item in three instanced meshes: full detail items that cast
 * shadows (only those close enough to the shadow box to land in it), the
 * other full detail ones, and cheap versions further out. Without the
 * split every shadow casting instance went through the shadow pass,
 * though the box covers only the hundred meters round the action. The
 * split is redone after the camera or the box moves a few meters, by
 * copying precomputed matrices, so it costs a short loop now and then and
 * allocates nothing.
 */
export function SplitInstances({ set, hi, lo, material, depth, radius, shadow }: Props) {
  const cast = useRef<THREE.InstancedMesh>(null);
  const near = useRef<THREE.InstancedMesh>(null);
  const far = useRef<THREE.InstancedMesh>(null);
  const last = useMemo(() => ({ eye: new THREE.Vector3(1e9, 0, 0), box: new THREE.Vector3(1e9, 0, 0) }), []);
  // New items, a new radius or a new shadow reach: forget the last split so the next frame redoes it.
  useEffect(() => void last.eye.set(1e9, 0, 0), [set, radius, shadow, last]);

  useFrame(({ camera }) => {
    const a = cast.current;
    const b = near.current;
    const c = far.current;
    if (!a || !b || !c) return;
    const box = shadow?.at.current;
    const moved = camera.position.distanceToSquared(last.eye) >= RESORT * RESORT || (box && box.distanceToSquared(last.box) >= RESORT * RESORT);
    if (!moved) return;
    last.eye.copy(camera.position);
    if (box) last.box.copy(box);
    withColors(a, set.count);
    withColors(b, set.count);
    withColors(c, set.count);
    const r2 = radius * radius;
    const s2 = shadow ? shadow.reach * shadow.reach : -1;
    let na = 0;
    let nb = 0;
    let nc = 0;
    for (let i = 0; i < set.count; i++) {
      const x = set.at[i * 3];
      const y = set.at[i * 3 + 1];
      const z = set.at[i * 3 + 2];
      const d2 = (x - camera.position.x) ** 2 + (y - camera.position.y) ** 2 + (z - camera.position.z) ** 2;
      if (d2 >= r2) writeInstance(c, nc++, set, i);
      else if (box && (x - box.x) ** 2 + (z - box.z) ** 2 < s2) writeInstance(a, na++, set, i);
      else writeInstance(b, nb++, set, i);
    }
    a.count = na;
    b.count = nb;
    c.count = nc;
    touch(a);
    touch(b);
    touch(c);
  });

  if (!set.count) return null;
  return (
    <>
      <instancedMesh ref={cast} args={[hi, material, set.count]} count={0} castShadow receiveShadow customDepthMaterial={depth} frustumCulled={false} />
      <instancedMesh ref={near} args={[hi, material, set.count]} count={0} receiveShadow={!!shadow} frustumCulled={false} />
      <instancedMesh ref={far} args={[lo, material, set.count]} count={0} receiveShadow={!!shadow} frustumCulled={false} />
    </>
  );
}

'use client';

import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Course } from '@/engine/navigation/course/build';
import { useDisposable } from '@/render/shared/useDisposable';
import { NAV_COLORS } from '../palette';
import { spikeBaseGeometry, spikeGeometry, spikeSpots, spikeTrimGeometry } from './spikeGeometry';

/** Most spikes a course draws. */
const CAPACITY = 6000;

/**
 * Spike pads that read as dangerous at a glance: rows of bright, sharp,
 * flat shaded steel pyramids on a near black plate, ringed by a red trim
 * that glows a touch. Three draw calls for every pad of the course.
 */
export function SpikePads({ course, shadows }: { course: Course; shadows: boolean }) {
  const spike = useDisposable(() => spikeGeometry(), []);
  const steel = useDisposable(() => new THREE.MeshStandardMaterial({ color: NAV_COLORS.spikeSteel, metalness: 0.55, roughness: 0.3, flatShading: true, envMapIntensity: 1.6 }), []);
  const plate = useDisposable(() => new THREE.MeshStandardMaterial({ color: NAV_COLORS.spikeBase, metalness: 0.35, roughness: 0.55 }), []);
  const trim = useDisposable(() => new THREE.MeshStandardMaterial({ color: NAV_COLORS.spikeTrim, roughness: 0.35, metalness: 0.1, emissive: NAV_COLORS.spikeTrim, emissiveIntensity: 0.35 }), []);
  const base = useDisposable(() => spikeBaseGeometry(course.spikes), [course]);
  const rim = useDisposable(() => spikeTrimGeometry(course.spikes), [course]);
  const spots = useMemo(() => spikeSpots(course.spikes), [course]);
  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const t = new THREE.Matrix4();
    const n = Math.min(CAPACITY, spots.length / 2);
    for (let i = 0; i < n; i++) m.setMatrixAt(i, t.makeTranslation(spots[i * 2], 0, spots[i * 2 + 1]));
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [spots]);

  if (!base || !rim) return null;
  return (
    <group>
      <mesh geometry={base} material={plate} receiveShadow={shadows} />
      <mesh geometry={rim} material={trim} castShadow={shadows} receiveShadow={shadows} />
      {/* Spikes stand too close to shade each other well: they cast, but take no shadow. */}
      <instancedMesh ref={mesh} args={[spike, steel, CAPACITY]} castShadow={shadows} />
    </group>
  );
}

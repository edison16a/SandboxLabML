'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Course } from '@/engine/navigation/course/build';
import { moverSweep, moverTopSpeed, moverVelocity } from '@/engine/navigation/course/movers';
import type { MoverSpec } from '@/engine/navigation/course/types';
import { useDisposable } from '@/render/shared/useDisposable';
import { POSE_PRIORITY, useNavScene } from '../frame/sceneContext';
import { NAV_COLORS } from '../palette';
import { crateMaterials, crateParts } from './crateMeshes';
import { moverGuideMaterial } from './moverGuide';

/** Whether a mover slides along x (else along z). */
function alongX(m: MoverSpec): boolean {
  return Math.abs(m.bx - m.ax) >= Math.abs(m.bz - m.az);
}

/**
 * The movers of a course: amber crates with lit frames that slide on rails
 * in the floor, each over a faint guide that shows all the floor it sweeps
 * and which way it is going. Positions come from the world stream, blended,
 * so they glide at any frame rate.
 */
export function Movers({ course, full, shadows }: { course: Course; full: boolean; shadows: boolean }) {
  const mats = useDisposable(() => crateMaterials(NAV_COLORS.mover, full, 0.22), [full]);
  return (
    <group>
      {course.movers.map((m, k) => (
        <Mover key={`${course.spec.id}:${k}`} index={k} mover={m} panel={mats.panel} brace={mats.brace} shadows={shadows} />
      ))}
    </group>
  );
}

function Mover({ index, mover, panel, brace, shadows }: { index: number; mover: MoverSpec; panel: THREE.Material; brace: THREE.Material; shadows: boolean }) {
  const { frame } = useNavScene();
  const parts = crateParts({ length: mover.hx * 2, width: mover.hz * 2, height: mover.height });
  const crate = useRef<THREE.Group>(null);
  const x = alongX(mover);
  const sweep = useMemo(() => moverSweep(mover), [mover]);
  const length = x ? sweep.hx * 2 : sweep.hz * 2;
  const width = x ? sweep.hz * 2 : sweep.hx * 2;
  const guide = useDisposable(() => moverGuideMaterial(length, width), [length, width]);
  const top = useMemo(() => moverTopSpeed(mover), [mover]);
  const v = useMemo(() => ({ x: 0, z: 0 }), []);

  useFrame(({ clock }) => {
    const g = crate.current;
    if (!g) return;
    g.position.set(frame.movers[index * 2], 0, frame.movers[index * 2 + 1]);
    moverVelocity(mover, frame.time, v);
    const along = x ? v.x : -v.z;
    guide.uniforms.uDir.value = along >= 0 ? 1 : -1;
    guide.uniforms.uActivity.value = Math.min(1, Math.abs(along) / Math.max(0.1, top * 0.4));
    guide.uniforms.uTime.value = clock.elapsedTime;
  }, POSE_PRIORITY);

  return (
    <group>
      <mesh position={[sweep.x, 0.006, sweep.z]} rotation={[-Math.PI / 2, 0, x ? 0 : Math.PI / 2]} material={guide} renderOrder={1} raycast={() => null}>
        <planeGeometry args={[length, width]} />
      </mesh>
      <group ref={crate}>
        <mesh geometry={parts.panels} material={panel} castShadow={shadows} receiveShadow={shadows} />
        <mesh geometry={parts.braces} material={brace} castShadow={shadows} receiveShadow={shadows} />
      </group>
    </group>
  );
}

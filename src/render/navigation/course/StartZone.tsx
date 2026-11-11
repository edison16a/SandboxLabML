'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import type { Course } from '@/engine/navigation/course/build';
import { useDisposable } from '@/render/shared/useDisposable';
import { POSE_PRIORITY, useNavScene } from '../frame/sceneContext';
import { setStartZone, startZoneMaterial } from './startZoneMaterial';

/** How far the zone's plane reaches past the start line, m, so the line's far edge is inside it. */
const PAST_LINE = 0.2;

/**
 * The start zone: the floor between the start wall and the start line,
 * where the crowd lines up on its grid. One plane, one draw call; the
 * rings follow how many agents the feed holds.
 */
export function StartZone({ course }: { course: Course }) {
  const { frame } = useNavScene();
  const material = useDisposable(() => startZoneMaterial(), []);
  useEffect(() => setStartZone(material, course), [material, course]);
  useFrame(() => {
    material.uniforms.uCount.value = frame.count;
  }, POSE_PRIORITY);
  const back = -course.halfLength;
  const length = course.startX + PAST_LINE - back;
  return (
    <mesh position={[back + length / 2, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={1} raycast={() => null}>
      <planeGeometry args={[length, course.spec.width]} />
    </mesh>
  );
}

'use client';

import { useFrame } from '@react-three/fiber';
import { useState } from 'react';
import type { Course } from '@/engine/navigation/course/build';
import { DRIVER_PRIORITY, useNavScene } from './sceneContext';

/**
 * The course on screen, as React state: it changes only when the feed
 * moves to a new course, so the static meshes built from it rebuild then
 * and never on an ordinary frame.
 */
export function useFrameCourse(): Course | null {
  const { frame } = useNavScene();
  const [course, setCourse] = useState<Course | null>(frame.course);
  useFrame(() => {
    if (frame.course !== course) setCourse(frame.course);
  }, DRIVER_PRIORITY + 0.5);
  return course;
}

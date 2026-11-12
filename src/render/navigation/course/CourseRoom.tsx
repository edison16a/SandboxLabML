'use client';

import type { Course } from '@/engine/navigation/course/build';
import type { Rect } from '@/engine/navigation/course/types';
import { floorAoMaterial } from '@/render/navigation/room/floorAoMaterial';
import { groundedMaterial } from '@/render/navigation/room/groundedMaterial';
import { floorAoGeometry } from '@/render/navigation/room/floorAoGeometry';
import { tileFloorMaterial } from '@/render/navigation/room/tileFloor';
import { useDisposable } from '@/render/shared/useDisposable';
import { NAV_COLORS } from '../palette';
import { courseFloorGeometry, courseWallGeometry, courseWalls } from './roomGeometry';

/**
 * The room of a course: light grey tiles with
 * crisp grout, a satin sheen and the odd engraved emblem, clean light grey
 * slab walls, and a baked band of shade along the foot of every wall and
 * crate so they sit on the floor even without screen space occlusion.
 * Three draw calls whatever the course.
 */
export function CourseRoom({ course, ao }: { course: Course; /** Strength of the baked shade, lower where screen space occlusion runs too. */ ao: number }) {
  const walls = useDisposable(() => courseWallGeometry(courseWalls(course)), [course]);
  const shade = useDisposable(() => {
    const crates: Rect[] = course.spec.obstacles.filter((o) => o.kind === 'block');
    return floorAoGeometry([...courseWalls(course), ...crates]);
  }, [course]);
  const floor = useDisposable(() => courseFloorGeometry(course), [course]);
  const shadeMat = useDisposable(() => floorAoMaterial(ao), [ao]);
  const floorMat = useDisposable(() => tileFloorMaterial(), []);
  const wallMat = useDisposable(() => groundedMaterial({ color: NAV_COLORS.wall, roughness: 0.58, metalness: 0, envMapIntensity: 0.65 }, 0.8, 0.8), []);
  return (
    <group>
      <mesh geometry={floor} material={floorMat} receiveShadow />
      <mesh geometry={shade} material={shadeMat} renderOrder={1} raycast={() => null} />
      <mesh geometry={walls} material={wallMat} castShadow receiveShadow />
    </group>
  );
}

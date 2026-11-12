'use client';

import type { Course } from '@/engine/navigation/course/build';
import { useDisposable } from '@/render/shared/useDisposable';
import { NAV_COLORS } from '../palette';
import { crateMaterials, mergedCrates } from './crateMeshes';

/**
 * The still crates of a course: golden braced crates, every one merged
 * into two meshes when the course changes.
 */
export function CourseBlocks({ course, full, shadows }: { course: Course; full: boolean; shadows: boolean }) {
  const mesh = useDisposable(() => {
    const crates = course.spec.obstacles.flatMap((o) => (o.kind === 'block' ? [{ x: o.x, z: o.z, length: o.hx * 2, width: o.hz * 2, height: o.height }] : []));
    const parts = mergedCrates(crates);
    if (!parts) return null;
    return {
      ...parts,
      dispose: () => {
        parts.panels.dispose();
        parts.braces.dispose();
      },
    };
  }, [course]);
  const mats = useDisposable(() => crateMaterials(NAV_COLORS.cube, full), [full]);
  if (!mesh) return null;
  return (
    <group>
      <mesh geometry={mesh.panels} material={mats.panel} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={mesh.braces} material={mats.brace} castShadow={shadows} receiveShadow={shadows} />
    </group>
  );
}

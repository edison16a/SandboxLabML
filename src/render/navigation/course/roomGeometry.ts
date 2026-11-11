import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Course } from '@/engine/navigation/course/build';
import { WALL_HEIGHT, type Rect } from '@/engine/navigation/course/types';

/** Rounding of every wall edge, m: a crisp slab that still catches a line of light, as in Hide and Seek. */
const WALL_EDGE = 0.03;

/**
 * Every wall of the course merged into one mesh, outer and inner alike,
 * so the room costs one draw call. Each wall reaches a hair below the
 * floor so its foot meets it square.
 */
export function courseWallGeometry(rects: readonly Rect[], height = WALL_HEIGHT): THREE.BufferGeometry {
  const parts = rects.map((r) => {
    const g = new RoundedBoxGeometry(r.hx * 2, height + WALL_EDGE, r.hz * 2, 2, WALL_EDGE);
    g.translate(r.x, (height - WALL_EDGE) / 2, r.z);
    g.deleteAttribute('uv');
    return g;
  });
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** The course floor, facing up. The tile shader works from position, so it needs no UVs. */
export function courseFloorGeometry(course: Course): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(course.spec.length, course.spec.width, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('uv');
  return g;
}

/** The walls of a course: the outer walls, then every inner wall segment. Blocks are crates and drawn apart. */
export function courseWalls(course: Course): Rect[] {
  const walls = course.solids.slice(0, 4);
  for (const o of course.spec.obstacles) if (o.kind === 'wall') walls.push(o);
  return walls;
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';

const ARENA = DEFAULT_HIDESEEK_PHYSICS.arena;

/** Rounding of every wall edge, m: small enough to read as a crisp slab, large enough to catch a line of light. */
const WALL_EDGE = 0.03;

/**
 * Every wall of a room merged into one mesh, so the room costs one draw
 * call however many walls it has. Each wall is a clean slab with lightly
 * rounded edges. It reaches below the floor by the rounding, so its foot
 * meets the floor square. Overlaps at corners share one material and
 * normal, so they never show.
 */
export function wallGeometry(rects: Rect[], segments = 2): THREE.BufferGeometry {
  const parts = rects.map((r) => {
    const g = new RoundedBoxGeometry(r.hx * 2, ARENA.wallHeight + WALL_EDGE, r.hz * 2, segments, WALL_EDGE);
    g.translate(r.x, (ARENA.wallHeight - WALL_EDGE) / 2, r.z);
    g.deleteAttribute('uv');
    return g;
  });
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** Width of the soft shadow on the floor along the foot of every wall, m. */
const AO_REACH = 0.55;

/**
 * Baked ambient occlusion for the floor: a band round the foot of every
 * wall, dark at the wall and clear AO_REACH away, as one mesh of vertex
 * alpha. It is what makes the walls sit on the floor on tiers without
 * screen space occlusion, and deepens inner corners where bands overlap.
 */
export function floorAoGeometry(rects: Rect[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const alpha: number[] = [];
  const y = 0.004;
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    // Each quad lists its corners clockwise seen from above, so the triangles take them in reverse to face up.
    for (const p of [a, c, b, a, d, c]) {
      pos.push(p[0], y, p[1]);
      alpha.push(p[2]);
    }
  };
  for (const r of rects) {
    const x0 = r.x - r.hx;
    const x1 = r.x + r.hx;
    const z0 = r.z - r.hz;
    const z1 = r.z + r.hz;
    const R = AO_REACH;
    // Four sides, each a quad from the wall face (opaque) out to the clear edge.
    quad([x0, z1, 1], [x1, z1, 1], [x1, z1 + R, 0], [x0, z1 + R, 0]);
    quad([x1, z0, 1], [x0, z0, 1], [x0, z0 - R, 0], [x1, z0 - R, 0]);
    quad([x1, z1, 1], [x1, z0, 1], [x1 + R, z0, 0], [x1 + R, z1, 0]);
    quad([x0, z0, 1], [x0, z1, 1], [x0 - R, z1, 0], [x0 - R, z0, 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aShade', new THREE.Float32BufferAttribute(alpha, 1));
  return g;
}

/** The floor of the room, facing up. The tile pattern comes from its position, so it needs no UVs. */
export function floorGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(ARENA.size, ARENA.size, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('uv');
  return g;
}

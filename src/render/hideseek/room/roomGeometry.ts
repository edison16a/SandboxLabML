import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { PLASTER_METERS } from './plasterMaps';

const ARENA = DEFAULT_HIDESEEK_PHYSICS.arena;

/**
 * Every wall of a room merged into one mesh, so the room costs one draw
 * call however many walls it has. Each wall is a rounded box whose rounding
 * is almost half its thickness, which gives it a soft round cap along the
 * top and round ends. The box reaches below the floor by that radius, so
 * only the top is rounded and the foot meets the floor square.
 */
export function wallGeometry(rects: Rect[], segments = 4): THREE.BufferGeometry {
  const parts = rects.map((r) => {
    const radius = Math.min(r.hx, r.hz) * 0.96;
    const g = new RoundedBoxGeometry(r.hx * 2, ARENA.wallHeight + radius, r.hz * 2, segments, radius);
    g.translate(r.x, (ARENA.wallHeight - radius) / 2, r.z);
    return g;
  });
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  boxProjectUVs(merged, PLASTER_METERS);
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Replaces per-face UVs with ones measured in meters, picked by the axis
 * each face looks along. A rounded box maps each face to 0..1, which would
 * stretch a texture twenty fold along a long wall; this keeps the plaster
 * the same scale on every wall and on both sides of it.
 */
function boxProjectUVs(g: THREE.BufferGeometry, metersPerRepeat: number): void {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const [u, v] = ny >= nx && ny >= nz ? [x, z] : nx >= nz ? [z, y] : [x, y];
    uv.setXY(i, u / metersPerRepeat, v / metersPerRepeat);
  }
  uv.needsUpdate = true;
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

/** The floor of the room, with UVs in meters divided by the texture span, so slabs stay square. */
export function floorGeometry(metersPerRepeat: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(ARENA.size, ARENA.size, 1, 1);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * ARENA.size) / metersPerRepeat, (uv.getY(i) * ARENA.size) / metersPerRepeat);
  return g;
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { PLASTER_METERS } from './plasterMaps';

const ARENA = DEFAULT_HIDESEEK_PHYSICS.arena;
/** Edge rounding of walls, m. Small, but enough to catch a highlight along every edge. */
const BEVEL = 0.035;

/**
 * Every wall of a room merged into one rounded box mesh, so the room costs
 * one draw call however many walls it has. Rounded edges are what make
 * the walls read as built objects rather than CG slabs.
 */
export function wallGeometry(rects: Rect[]): THREE.BufferGeometry {
  const parts = rects.map((r) => {
    const g = new RoundedBoxGeometry(r.hx * 2, ARENA.wallHeight, r.hz * 2, 3, Math.min(BEVEL, r.hx, r.hz));
    g.translate(r.x, ARENA.wallHeight / 2, r.z);
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

/**
 * A dark skirting board round the foot of every wall, a hair proud of the
 * plaster. It is the small line where wall meets floor that makes a room
 * read as built rather than modeled.
 */
export function skirtingGeometry(rects: Rect[]): THREE.BufferGeometry {
  const parts = rects.map((r) => {
    const g = new THREE.BoxGeometry(r.hx * 2 + 0.024, 0.09, r.hz * 2 + 0.024);
    g.translate(r.x, 0.045, r.z);
    return g;
  });
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * Thin light strips along the inner top edge of the four outer walls. They
 * are emissive, so with bloom on they read as the room's lighting fixtures.
 */
export function stripGeometry(): THREE.BufferGeometry {
  const half = ARENA.size / 2;
  const y = ARENA.wallHeight - 0.09;
  const t = 0.03;
  const long = ARENA.size - 0.6;
  const strips = [
    [0, -half + t, long, t],
    [0, half - t, long, t],
    [-half + t, 0, t, long],
    [half - t, 0, t, long],
  ].map(([x, z, sx, sz]) => {
    const g = new THREE.BoxGeometry(sx, 0.035, sz);
    g.translate(x, y, z);
    return g;
  });
  const merged = mergeGeometries(strips) as THREE.BufferGeometry;
  strips.forEach((s) => s.dispose());
  return merged;
}

/** The floor of the room, with UVs in meters divided by the texture span, so tiles stay square. */
export function floorGeometry(metersPerRepeat: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(ARENA.size, ARENA.size, 1, 1);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * ARENA.size) / metersPerRepeat, (uv.getY(i) * ARENA.size) / metersPerRepeat);
  return g;
}

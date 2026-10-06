import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';

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
  merged.computeBoundingSphere();
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

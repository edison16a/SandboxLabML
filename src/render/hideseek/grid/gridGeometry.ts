import * as THREE from 'three';
import { ARENA_SPAN } from '../layout/gridLattice';

/**
 * A flat fan for a vision cone on the grid: apex at the origin, centered on
 * +x, `fov` wide. Vertex alpha fades from the apex outwards, so plain
 * alpha blending gives a soft cone with no texture.
 */
export function fanGeometry(radius: number, fov: number, segments = 16): THREE.BufferGeometry {
  const pos: number[] = [0, 0, 0];
  const col: number[] = [1, 1, 1, 0.55];
  for (let k = 0; k <= segments; k++) {
    const a = -fov / 2 + (fov * k) / segments;
    pos.push(Math.cos(a) * radius, 0, -Math.sin(a) * radius);
    col.push(1, 1, 1, 0);
  }
  const index: number[] = [];
  for (let k = 1; k <= segments; k++) index.push(0, k, k + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(index);
  return g;
}

/** A thin square frame just outside an arena's outer walls, for the balance tint. */
export function borderGeometry(width = 0.35): THREE.BufferGeometry {
  const o = ARENA_SPAN / 2 + 0.25 + width;
  const i = ARENA_SPAN / 2 + 0.25;
  const shape = new THREE.Shape([new THREE.Vector2(-o, -o), new THREE.Vector2(o, -o), new THREE.Vector2(o, o), new THREE.Vector2(-o, o)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(-i, -i), new THREE.Vector2(-i, i), new THREE.Vector2(i, i), new THREE.Vector2(i, -i)]));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  return g;
}

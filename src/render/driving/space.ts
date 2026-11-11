import type * as THREE from 'three';

/**
 * The simulation is 2D in (x, y) with headings counterclockwise from +x;
 * three.js is Y up. Sim (x, y) is world (x, height, -y), and a sim heading
 * is a rotation of the same angle about +Y. Every driving scene part goes
 * through these, so none of them has to think about it.
 */
export function simToWorld(x: number, y: number, out: THREE.Vector3, height = 0): THREE.Vector3 {
  return out.set(x, height, -y);
}

/** World z for a sim y. */
export function worldZ(y: number): number {
  return -y;
}

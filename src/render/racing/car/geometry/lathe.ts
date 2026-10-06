import * as THREE from 'three';
import { merge } from './grid';

/** A profile point in (radius, axial offset). Axial offsets grow toward the outside of the car. */
export type Profile = Array<[number, number]>;

/**
 * Spins a profile around the wheel axle (Z). Each listed run of points is
 * a smooth surface; runs meet at hard edges. Walk the profile so the
 * outside of the part is on your right, the rule three's lathe follows.
 */
export function lathe(runs: Profile[], segments: number): THREE.BufferGeometry {
  const parts = runs.map((run) => {
    const g = new THREE.LatheGeometry(
      run.map(([r, a]) => new THREE.Vector2(r, a)),
      segments,
    );
    // Lathe spins around Y; turn it so the axle runs along Z with the outer face toward +Z.
    g.rotateX(Math.PI / 2);
    return g;
  });
  return merge(parts);
}

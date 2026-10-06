import * as THREE from 'three';

/** A unit cube standing on the floor (y from 0 to 1), scaled per instance into walls and backdrop blocks. */
export function standingUnitBox(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return g;
}

/** A floor quad, centered, facing up. */
export function floorQuad(size: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  return g;
}

import * as THREE from 'three';

/** A unit cube standing on the floor (y from 0 to 1), scaled per instance into walls and backdrop blocks. */
export function standingUnitBox(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return g;
}

/**
 * standingUnitBox without its bottom face, for blocks that stand on the
 * ground where the bottom can never be seen: a sixth fewer triangles over
 * thousands of city blocks.
 */
export function openUnitBox(): THREE.BufferGeometry {
  const g = standingUnitBox();
  // BoxGeometry lists its faces +x, -x, +y, -y, +z, -z, two triangles (six indices) each.
  const index = Array.from(g.index?.array ?? []);
  index.splice(18, 6);
  g.setIndex(index);
  g.deleteAttribute('uv');
  return g;
}

/** A floor quad, centered, facing up. */
export function floorQuad(size: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  return g;
}

import * as THREE from 'three';

/** An axis aligned rectangle on the floor: its center and half sizes, m. */
export interface FloorRect {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

/** Width of the soft shadow on the floor along the foot of every wall, m. */
const AO_REACH = 0.55;

/**
 * Baked ambient occlusion for the floor: a band round the foot of every
 * wall, dark at the wall and clear AO_REACH away, as one mesh of vertex
 * alpha. It is what makes the walls sit on the floor on tiers without
 * screen space occlusion, and deepens inner corners where bands overlap.
 */
export function floorAoGeometry(rects: FloorRect[]): THREE.BufferGeometry {
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

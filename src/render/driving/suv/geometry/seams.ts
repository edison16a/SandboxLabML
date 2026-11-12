import * as THREE from 'three';
import { gridGeometry, type Vec3 } from './grid';

/**
 * A panel gap across its width, as (offset from its center line in m,
 * how dark): a 5.6 mm dark core with a soft 5 mm falloff either side. A
 * real gap reads as its shadow, soft at the edges; a hard line that thin
 * falls under a pixel at the orbit camera's distance and breaks into
 * dots, while this one fades to a smooth, slightly fainter line.
 */
export const SEAM: ReadonlyArray<readonly [number, number]> = [[-0.008, 0], [-0.0028, 0.92], [0.0028, 0.92], [0.008, 0]];
/** How far a gap's line stands off the paint, m. */
export const SEAM_LIFT = 0.0015;

/**
 * A soft dark line from rows of points, one row per SEAM entry in order,
 * each running along the line. It carries its darkness as vertex alpha
 * for the transparent 'seam' material.
 */
export function seamGeometry(rows: Vec3[][]): THREE.BufferGeometry {
  const g = gridGeometry(rows);
  const n = rows[0].length;
  const color = new Float32Array(rows.length * n * 4);
  rows.forEach((_, i) => {
    for (let j = 0; j < n; j++) color.set([0, 0, 0, SEAM[i][1]], (i * n + j) * 4);
  });
  g.setAttribute('color', new THREE.BufferAttribute(color, 4));
  return g;
}

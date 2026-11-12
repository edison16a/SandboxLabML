import type * as THREE from 'three';
import type { Vec3 } from '../../suv/geometry/grid';

/** One row of a panel grid: the station it was cut at and the wheel opening floor it was cut to. */
export interface RowAt {
  x: number;
  floor: number;
}

/** A panel's placed points at station x, cut to `floor`, with every span's steps times k. */
export type PanelAt = (x: number, floor: number, k: number) => Vec3[];

/** How much finer the section is sampled to read its tangent, and the step along the car, m. */
const FINE = 4;
const STEP = 0.002;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** The surface normals of one row: across the section and along the car, crossed. Null where either tangent vanishes. */
function rowNormals(at: PanelAt, x: number, floor: number, half: number): Array<Vec3 | null> {
  const fine = at(x, floor, FINE);
  const last = fine.length - 1;
  const x0 = Math.max(-half, x - STEP);
  const x1 = Math.min(half, x + STEP);
  const a = at(x0, floor, 1);
  const b = at(x1, floor, 1);
  return a.map((_, j) => {
    const across = sub(fine[Math.min(FINE * j + 1, last)], fine[Math.max(FINE * j - 1, 0)]);
    const along = sub(b[j], a[j]);
    const n = cross(along, across);
    const len = length(n);
    if (len < 1e-7 * Math.max(1e-9, length(along) * length(across)) || len < 1e-14) return null;
    return [n[0] / len, n[1] / len, n[2] / len];
  });
}

/**
 * Gives a lofted panel the normals of the smooth surface it samples,
 * instead of the average of its own flat triangles. The body is coarse
 * for traffic, and averaged normals swing with every uneven triangle,
 * which is what makes low poly paint look lumpy; the surface's own
 * normals shade it as if it were finely built. Rows run along +x and
 * columns up the section, so across x along points out. Where a section
 * pinches to a point (the tips, a buried trim row) the normal is read a
 * centimeter in toward the middle; failing that, the averaged one stays.
 */
export function trueNormals(g: THREE.BufferGeometry, rows: readonly RowAt[], at: PanelAt, half: number): void {
  const n = g.attributes.normal;
  const nc = n.count / rows.length;
  rows.forEach((r, i) => {
    const here = rowNormals(at, r.x, r.floor, half);
    let inward: Array<Vec3 | null> | null = null;
    for (let j = 0; j < nc; j++) {
      let v = here[j];
      if (!v) {
        inward ??= rowNormals(at, r.x - Math.sign(r.x) * 0.01, r.floor, half);
        v = inward[j];
      }
      if (v) n.setXYZ(i * nc + j, v[0], v[1], v[2]);
    }
  });
  // A row pinched to one point has no normal of its own (a buried trim row at a wheel opening's
  // edge): it borrows its neighbor row's, so the slivers it closes shade like the paint beside them.
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < nc; j++) {
      const k = i * nc + j;
      if (Math.hypot(n.getX(k), n.getY(k), n.getZ(k)) > 0.5) continue;
      const from = i > 0 ? k - nc : k + nc;
      if (from < n.count) n.setXYZ(k, n.getX(from), n.getY(from), n.getZ(from));
    }
  }
  n.needsUpdate = true;
}

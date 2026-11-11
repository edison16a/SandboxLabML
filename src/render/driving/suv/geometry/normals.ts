import type * as THREE from 'three';
import type { Vec3 } from './grid';
import { archFloor, NOSE, TAIL } from './profile';
import type { Pt } from './section';
import { warp } from './warp';

/** Step along the car for the tangent there, m. */
const STEP = 0.0015;
/** Each step across the section is cut in this many for the tangent across it. */
const SPLIT = 4;

const inArch = (x: number) => archFloor(x) >= 0;

/**
 * The two stations a tangent along the car is taken between. Both stay on
 * the same side of an arch's end: the side skin stops short over a wheel,
 * so a difference across that line would be meaningless.
 */
function around(x: number): [number, number] {
  const lo = Math.max(TAIL, x - STEP);
  const hi = Math.min(NOSE, x + STEP);
  const here = inArch(x);
  const back = inArch(lo) === here;
  const ahead = inArch(hi) === here;
  if (back && ahead) return [lo, hi];
  return ahead ? [x, hi] : [lo, x];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const at = (x: number, [z, y]: Pt) => warp([x, y, z]);

/**
 * Sets the body panels' normals from the surface itself instead of
 * averaging its triangles. Stations bunch up round the arches and ends,
 * and an averaged normal there leans toward the bigger triangles, so the
 * reflections break in a line; panels that meet smoothly also each saw
 * only their own side. Here the tangent along the car comes from the
 * section a hair either side of the station, the tangent across from a
 * finer sampling of the same section, both through the warp, so every
 * vertex gets the true normal and shared vertices agree.
 *
 * `outlineAt(x, k)` is the section at x from sill to centerline with each
 * step cut in k, `starts[p]` the index where panel p starts in it, and
 * `creased[p]` whether panel p meets the one before it in a crease, which
 * keeps one sided normals so the crease stays crisp.
 */
export function bodyNormals(grids: THREE.BufferGeometry[], xs: number[], outlineAt: (x: number, k: number) => Pt[], starts: number[], creased: boolean[]): void {
  xs.forEach((x, i) => {
    const fine = outlineAt(x, SPLIT).map((p) => at(x, p));
    const [x0, x1] = around(x);
    const r0 = outlineAt(x0, 1);
    const r1 = outlineAt(x1, 1);
    const last = r0.length - 1;
    grids.forEach((g, p) => {
      const normal = g.attributes.normal;
      const cols = normal.count / xs.length;
      const lo = creased[p] ? starts[p] : 0;
      const hi = p + 1 < grids.length && creased[p + 1] ? starts[p + 1] : last;
      for (let j = 0; j < cols; j++) {
        const k = starts[p] + j;
        const tx = sub(at(x1, r1[k]), at(x0, r0[k]));
        const tu = sub(fine[Math.min(k * SPLIT + 1, hi * SPLIT)], fine[Math.max(k * SPLIT - 1, lo * SPLIT)]);
        if (Math.hypot(...tu) < 1e-7) continue;
        const n: Vec3 = [tx[1] * tu[2] - tx[2] * tu[1], tx[2] * tu[0] - tx[0] * tu[2], tx[0] * tu[1] - tx[1] * tu[0]];
        // The two halves meet on the centerline, where by symmetry the surface faces straight out of the plane.
        if (k === last) n[2] = 0;
        const len = Math.hypot(...n);
        if (len < 1e-12) continue;
        const v = i * cols + j;
        // Keep the side the triangles face; this only corrects the direction.
        const s = n[0] * normal.getX(v) + n[1] * normal.getY(v) + n[2] * normal.getZ(v) < 0 ? -1 : 1;
        normal.setXYZ(v, (s * n[0]) / len, (s * n[1]) / len, (s * n[2]) / len);
      }
    });
  });
}

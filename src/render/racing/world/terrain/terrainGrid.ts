import { terrainHeight, type TerrainShape } from './terrainHeight';

/**
 * Grid lines along one axis: evenly spaced over the circuit, then growing
 * further apart out to the horizon. One mesh then covers kilometers of
 * hills with fine triangles only where the camera can see detail.
 */
export function gridAxis(center: number, half: number, step: number, reach: number, outer = 22): Float32Array {
  const n = Math.ceil(half / step);
  const fine = n * step;
  const out = new Float32Array(n * 2 + 1 + outer * 2);
  let k = 0;
  for (let i = outer; i >= 1; i--) out[k++] = center - fine - (reach - fine) * (i / outer) ** 2.2;
  for (let i = -n; i <= n; i++) out[k++] = center + i * step;
  for (let i = 1; i <= outer; i++) out[k++] = center + fine + (reach - fine) * (i / outer) ** 2.2;
  return out;
}

/** The terrain as plain arrays: positions on a stretched grid and the triangle list. */
export interface TerrainGrid {
  xs: Float32Array;
  zs: Float32Array;
  position: Float32Array;
  index: Uint32Array;
}

/**
 * Samples the height function on the grid. `step` is the fine spacing in
 * meters; the fine area covers the circuit plus a margin wide enough for the
 * nearest hills.
 */
export function buildTerrainGrid(shape: TerrainShape, step: number, reach = 4800): TerrainGrid {
  const f = shape.field;
  const margin = 170;
  const xs = gridAxis(f.centerX, f.extentX + margin, step, reach);
  const zs = gridAxis(f.centerZ, f.extentZ + margin, step, reach);
  const nx = xs.length;
  const nz = zs.length;
  const position = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const o = (j * nx + i) * 3;
      position[o] = xs[i];
      position[o + 1] = terrainHeight(shape, xs[i], zs[j]);
      position[o + 2] = zs[j];
    }
  }
  const index = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let k = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      // Counter clockwise seen from above, so normals point up.
      index[k++] = a;
      index[k++] = c;
      index[k++] = b;
      index[k++] = b;
      index[k++] = c;
      index[k++] = d;
    }
  }
  return { xs, zs, position, index };
}

/** Index of the last grid line at or before `v` (binary search), for finding vertices near a point. */
export function lineBefore(lines: Float32Array, v: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines[mid] <= v) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

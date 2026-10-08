import { STRIDE, type Flora } from '../flora/placement';
import { paintTerrain } from './terrainColors';
import { buildTerrainGrid, lineBefore } from './terrainGrid';
import type { TerrainShape } from './terrainHeight';

/**
 * Darkens the ground under every tree and big rock, a cheap stand in for
 * the shade and ambient occlusion a far tree's shadow would give. The
 * sun's real shadows only cover the area round the camera, so without this
 * distant groves float on the hills.
 */
function shadeUnder(color: Float32Array, xs: Float32Array, zs: Float32Array, items: Float32Array, radius: number, depth: number): void {
  const nx = xs.length;
  for (let k = 0; k < items.length; k += STRIDE) {
    const x = items[k];
    const z = items[k + 2];
    const r = radius * items[k + 3];
    const i0 = lineBefore(xs, x - r);
    const i1 = lineBefore(xs, x + r) + 1;
    const j0 = lineBefore(zs, z - r);
    const j1 = lineBefore(zs, z + r) + 1;
    for (let j = j0; j <= Math.min(zs.length - 1, j1); j++) {
      for (let i = i0; i <= Math.min(nx - 1, i1); i++) {
        const d = Math.hypot(xs[i] - x, zs[j] - z) / r;
        if (d >= 1) continue;
        const shade = 1 - depth * (1 - d * d);
        const o = (j * nx + i) * 3;
        color[o] *= shade;
        color[o + 1] *= shade;
        color[o + 2] *= shade;
      }
    }
  }
}

/** The terrain mesh as plain arrays, ready to cross from a worker and become a geometry on the page. */
export interface TerrainArrays {
  position: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  surface: Float32Array;
  index: Uint32Array;
}

/**
 * Smooth vertex normals for an indexed mesh: each face adds its area
 * weighted normal to its three corners, then every sum is normalized. The
 * same result as three's computeVertexNormals, without three.
 */
export function vertexNormals(position: Float32Array, index: Uint32Array): Float32Array {
  const n = new Float32Array(position.length);
  for (let k = 0; k < index.length; k += 3) {
    const a = index[k] * 3;
    const b = index[k + 1] * 3;
    const c = index[k + 2] * 3;
    const ux = position[b] - position[a];
    const uy = position[b + 1] - position[a + 1];
    const uz = position[b + 2] - position[a + 2];
    const vx = position[c] - position[a];
    const vy = position[c + 1] - position[a + 1];
    const vz = position[c + 2] - position[a + 2];
    // (b - a) x (c - a), the same face normal three takes as (c - b) x (a - b).
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    n[a] += nx;
    n[a + 1] += ny;
    n[a + 2] += nz;
    n[b] += nx;
    n[b + 1] += ny;
    n[b + 2] += nz;
    n[c] += nx;
    n[c + 1] += ny;
    n[c + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= len;
    n[i + 1] /= len;
    n[i + 2] /= len;
  }
  return n;
}

/** Builds the ground mesh's arrays: heights on the stretched grid, normals, colors and the detail mask. */
export function buildTerrainArrays(shape: TerrainShape, flora: Flora, step: number): TerrainArrays {
  const grid = buildTerrainGrid(shape, step);
  const normal = vertexNormals(grid.position, grid.index);
  const paint = paintTerrain(shape, grid.position, normal);
  shadeUnder(paint.color, grid.xs, grid.zs, flora.pines, 4.2, 0.38);
  shadeUnder(paint.color, grid.xs, grid.zs, flora.broadleaf, 5, 0.42);
  shadeUnder(paint.color, grid.xs, grid.zs, flora.rocks, 1.6, 0.3);
  return { position: grid.position, normal, color: paint.color, surface: paint.surface, index: grid.index };
}

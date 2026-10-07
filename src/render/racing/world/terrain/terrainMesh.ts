import * as THREE from 'three';
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

/** Builds the ground mesh: heights on the stretched grid, normals, colors and the detail mask. */
export function buildTerrainGeometry(shape: TerrainShape, flora: Flora, step: number): THREE.BufferGeometry {
  const grid = buildTerrainGrid(shape, step);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(grid.position, 3));
  g.setIndex(new THREE.BufferAttribute(grid.index, 1));
  g.computeVertexNormals();
  const paint = paintTerrain(shape, grid.position, (g.attributes.normal as THREE.BufferAttribute).array as Float32Array);
  shadeUnder(paint.color, grid.xs, grid.zs, flora.pines, 4.2, 0.38);
  shadeUnder(paint.color, grid.xs, grid.zs, flora.broadleaf, 5, 0.42);
  shadeUnder(paint.color, grid.xs, grid.zs, flora.rocks, 1.6, 0.3);
  g.setAttribute('color', new THREE.BufferAttribute(paint.color, 3));
  g.setAttribute('surface', new THREE.BufferAttribute(paint.surface, 2));
  g.computeBoundingSphere();
  return g;
}

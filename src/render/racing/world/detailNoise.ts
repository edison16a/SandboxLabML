import * as THREE from 'three';
import { hash2 } from './noise';

/** Value noise that wraps every `period` cells, so the texture tiles with no seam. */
function tiled(x: number, z: number, period: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const w = (v: number) => ((v % period) + period) % period;
  const a = hash2(w(ix), w(iz), seed);
  const b = hash2(w(ix + 1), w(iz), seed);
  const c = hash2(w(ix), w(iz + 1), seed);
  const d = hash2(w(ix + 1), w(iz + 1), seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

let shared: THREE.DataTexture | null = null;
let users = 0;

/**
 * A tiling texture of noise in three channels: fine grain (R), soft blotches
 * (G) and long streaks (B). Ground, asphalt and rock shaders sample it at a
 * couple of scales for close up detail without any image files. One copy is
 * shared; release it with `releaseDetailNoise` when a scene unmounts.
 */
export function detailNoise(): THREE.DataTexture {
  users++;
  if (shared) return shared;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const fine = tiled(x / 2, y / 2, size / 2, 3) * 0.6 + tiled(x / 1, y / 1, size, 5) * 0.4;
      const blot = tiled(x / 32, y / 32, size / 32, 7) * 0.55 + tiled(x / 12, y / 12, size / 12 + 0, 9) * 0.3 + tiled(x / 6, y / 6, size / 6, 11) * 0.15;
      const streak = tiled(x / 64, y / 1.5, size / 64, 13) * 0.7 + tiled(x / 2, y / 3, size / 2, 17) * 0.3;
      data[o] = fine * 255;
      data[o + 1] = blot * 255;
      data[o + 2] = streak * 255;
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  shared = t;
  return t;
}

/** Drops one user of the shared texture and frees it on the GPU once nobody holds it. */
export function releaseDetailNoise(): void {
  users = Math.max(0, users - 1);
  if (users === 0 && shared) {
    shared.dispose();
    shared = null;
  }
}

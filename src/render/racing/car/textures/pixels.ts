import * as THREE from 'three';

/**
 * Builds a tiling RGBA texture from a per pixel function. Car textures are
 * computed, not downloaded, and DataTexture keeps them free of canvas and
 * DOM, so they can be made anywhere.
 */
export function pixelTexture(size: number, srgb: boolean, fill: (x: number, y: number, out: [number, number, number, number]) => void): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const px: [number, number, number, number] = [0, 0, 0, 255];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      px[3] = 255;
      fill(x, y, px);
      const k = (y * size + x) * 4;
      data[k] = px[0];
      data[k + 1] = px[1];
      data[k + 2] = px[2];
      data[k + 3] = px[3];
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** A small deterministic hash to [0, 1), so textures come out the same on every load. */
export function hash(a: number, b: number, seed = 0): number {
  let h = (a * 374761393 + b * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Packs a unit normal into a normal map texel. */
export function packNormal(nx: number, ny: number, out: [number, number, number, number]): void {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  out[0] = Math.round((nx * 0.5 + 0.5) * 255);
  out[1] = Math.round((ny * 0.5 + 0.5) * 255);
  out[2] = Math.round((nz * 0.5 + 0.5) * 255);
}

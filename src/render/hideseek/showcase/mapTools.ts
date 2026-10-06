import * as THREE from 'three';
import type { Rng } from '@/engine/core/rng';

/**
 * Smooth value noise on a wrapping grid of `cells` across a `size` px
 * texture, so anything built from it tiles without seams.
 */
export function valueNoise(rng: Rng, cells: number, size: number): (x: number, y: number) => number {
  const grid = Float32Array.from({ length: cells * cells }, () => rng.next());
  const at = (i: number, j: number) => grid[((j + cells) % cells) * cells + ((i + cells) % cells)];
  return (x, y) => {
    const fx = (x / size) * cells;
    const fy = (y / size) * cells;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = fx - i;
    const v = fy - j;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * su;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * su;
    return a + (b - a) * sv;
  };
}

/**
 * A tangent space normal map from a wrapping height field, by central
 * differences. Canvas rows run down while texture v runs up, hence the
 * sign on the y slope.
 */
export function normalFromHeight(height: Float32Array, size: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out[i] = (-dx / len) * 127.5 + 127.5;
      out[i + 1] = (dy / len) * 127.5 + 127.5;
      out[i + 2] = (1 / len) * 127.5 + 127.5;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Puts RGBA pixels on a canvas and wraps it as a repeating texture. Color maps are sRGB, data maps linear. */
export function toTexture(data: Uint8ClampedArray, size: number, color: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** A set of surface maps drawn once and kept for the page's life. */
export interface SurfaceMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

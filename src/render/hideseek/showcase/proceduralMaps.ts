import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';

/** Size of the floor texture, px. It covers FLOOR_TILE_METERS, so 256 px per meter: crisp on a 4K screen. */
const SIZE = 1024;
/** The texture spans 4 x 4 m of floor: sixteen 1 m tiles, each with its own tone. */
export const FLOOR_TILE_METERS = 4;
const TILES = 4;
const GROUT = 5;

/** Smooth value noise on a wrapping grid, so the texture tiles without seams. */
function valueNoise(rng: Rng, cells: number): (x: number, y: number) => number {
  const grid = Float32Array.from({ length: cells * cells }, () => rng.next());
  const at = (i: number, j: number) => grid[((j + cells) % cells) * cells + ((i + cells) % cells)];
  return (x, y) => {
    const fx = (x / SIZE) * cells;
    const fy = (y / SIZE) * cells;
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

/** Distance in px to the nearest grout line, 0 on the line. */
function groutDistance(x: number, y: number): number {
  const cell = SIZE / TILES;
  const dx = Math.min(x % cell, cell - (x % cell));
  const dy = Math.min(y % cell, cell - (y % cell));
  return Math.min(dx, dy);
}

function toTexture(data: Uint8ClampedArray, color: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, SIZE, SIZE), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export interface FloorMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  dispose(): void;
}

/**
 * Polished concrete tiles: albedo with a tone per tile, fine aggregate and
 * soft mottling; a height field (grout grooves plus micro relief) turned
 * into a tangent space normal map; and roughness that is glossier in worn
 * patches and matte in the grout. Drawn once, about 1 M pixels each.
 */
export function floorMaps(seed = 11): FloorMaps {
  const rng = new Rng(seed);
  const mottle = valueNoise(rng, 8);
  const fine = valueNoise(rng, 64);
  const micro = valueNoise(rng, 256);
  const tone = Float32Array.from({ length: TILES * TILES }, () => rng.range(-0.05, 0.05));
  const albedo = new Uint8ClampedArray(SIZE * SIZE * 4);
  const rough = new Uint8ClampedArray(SIZE * SIZE * 4);
  const height = new Float32Array(SIZE * SIZE);
  const cell = SIZE / TILES;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const g = groutDistance(x, y);
      const groove = g < GROUT ? 1 - g / GROUT : 0;
      const m = mottle(x, y);
      const f = fine(x, y);
      const speck = rng.next() > 0.996 ? 0.08 : 0;
      const t = tone[Math.floor(y / cell) * TILES + Math.floor(x / cell)];
      const v = 0.6 + t + (m - 0.5) * 0.12 + (f - 0.5) * 0.06 + speck - groove * 0.28;
      albedo[i * 4] = v * 196;
      albedo[i * 4 + 1] = v * 200;
      albedo[i * 4 + 2] = v * 207;
      albedo[i * 4 + 3] = 255;
      const r = 0.62 + (m - 0.5) * 0.3 + (micro(x, y) - 0.5) * 0.12 + groove * 0.3;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = Math.min(1, Math.max(0.2, r)) * 255;
      rough[i * 4 + 3] = 255;
      height[i] = -groove * 1.4 + (micro(x, y) - 0.5) * 0.18 + (f - 0.5) * 0.12;
    }
  }
  const normal = new Uint8ClampedArray(SIZE * SIZE * 4);
  const h = (x: number, y: number) => height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const len = Math.hypot(dx, dy, 1);
      const i = (y * SIZE + x) * 4;
      normal[i] = (-dx / len) * 127.5 + 127.5;
      normal[i + 1] = (dy / len) * 127.5 + 127.5;
      normal[i + 2] = (1 / len) * 127.5 + 127.5;
      normal[i + 3] = 255;
    }
  }
  const maps = { map: toTexture(albedo, true), normalMap: toTexture(normal, false), roughnessMap: toTexture(rough, false) };
  return { ...maps, dispose: () => Object.values(maps).forEach((t) => t.dispose()) };
}

let shared: FloorMaps | null = null;

/**
 * The floor maps, drawn the first time a showcase opens and kept for the
 * page's life. Drawing them takes a noticeable moment, which would land on
 * every focus change if each showcase drew its own.
 */
export function sharedFloorMaps(): FloorMaps {
  shared ??= floorMaps();
  return shared;
}

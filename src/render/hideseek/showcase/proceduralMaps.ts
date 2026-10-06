import { Rng } from '@/engine/core/rng';
import { normalFromHeight, toTexture, valueNoise, type SurfaceMaps } from './mapTools';

/** Size of the floor texture, px. It covers FLOOR_TILE_METERS, so 256 px per meter: crisp on a 4K screen. */
const SIZE = 1024;
/** The texture spans 4 x 4 m of floor: sixteen 1 m tiles, each with its own tone. */
export const FLOOR_TILE_METERS = 4;
const TILES = 4;
const GROUT = 5;

/** Distance in px to the nearest grout line, 0 on the line. */
function groutDistance(x: number, y: number): number {
  const cell = SIZE / TILES;
  const dx = Math.min(x % cell, cell - (x % cell));
  const dy = Math.min(y % cell, cell - (y % cell));
  return Math.min(dx, dy);
}

/**
 * Polished concrete tiles: albedo with a tone per tile, fine aggregate and
 * soft mottling; a height field (grout grooves plus micro relief) turned
 * into a normal map; and roughness that is glossier in worn patches and
 * matte in the grout. Drawn once, about a million pixels each.
 */
export function floorMaps(seed = 11): SurfaceMaps {
  const rng = new Rng(seed);
  const mottle = valueNoise(rng, 8, SIZE);
  const fine = valueNoise(rng, 64, SIZE);
  const micro = valueNoise(rng, 256, SIZE);
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
      const mi = micro(x, y);
      const speck = rng.next() > 0.996 ? 0.08 : 0;
      const t = tone[Math.floor(y / cell) * TILES + Math.floor(x / cell)];
      const v = 0.6 + t + (m - 0.5) * 0.12 + (f - 0.5) * 0.06 + speck - groove * 0.28;
      albedo[i * 4] = v * 196;
      albedo[i * 4 + 1] = v * 200;
      albedo[i * 4 + 2] = v * 207;
      albedo[i * 4 + 3] = 255;
      const r = 0.62 + (m - 0.5) * 0.3 + (mi - 0.5) * 0.12 + groove * 0.3;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = Math.min(1, Math.max(0.2, r)) * 255;
      rough[i * 4 + 3] = 255;
      height[i] = -groove * 1.4 + (mi - 0.5) * 0.18 + (f - 0.5) * 0.12;
    }
  }
  return { map: toTexture(albedo, SIZE, true), normalMap: toTexture(normalFromHeight(height, SIZE), SIZE, false), roughnessMap: toTexture(rough, SIZE, false) };
}

let shared: SurfaceMaps | null = null;

/**
 * The floor maps, drawn the first time a showcase opens and kept for the
 * page's life. Drawing them takes a noticeable moment, which would land on
 * every focus change if each showcase drew its own.
 */
export function sharedFloorMaps(): SurfaceMaps {
  shared ??= floorMaps();
  return shared;
}

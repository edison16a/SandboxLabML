import { Rng } from '@/engine/core/rng';
import { normalFromHeight, toTexture, valueNoise, type SurfaceMaps } from './mapTools';

const SIZE = 512;
/** The plaster texture spans 2 x 2 m of wall. */
export const PLASTER_METERS = 2;

/**
 * Soft matte plaster in a warm white: a faint trowelled relief from two
 * octaves of noise, a barely visible tone drift, and roughness that is a
 * touch less matte where the trowel pressed. Subtle on purpose: walls
 * should read as a material, not as a pattern.
 */
function plasterMaps(seed = 29): SurfaceMaps {
  const rng = new Rng(seed);
  const broad = valueNoise(rng, 6, SIZE);
  const mid = valueNoise(rng, 24, SIZE);
  const fine = valueNoise(rng, 128, SIZE);
  const albedo = new Uint8ClampedArray(SIZE * SIZE * 4);
  const rough = new Uint8ClampedArray(SIZE * SIZE * 4);
  const height = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const b = broad(x, y);
      const m = mid(x, y);
      const f = fine(x, y);
      const v = 1 + ((b - 0.5) * 10 + (f - 0.5) * 4) / 240;
      albedo[i * 4] = 241 * v;
      albedo[i * 4 + 1] = 239 * v;
      albedo[i * 4 + 2] = 235 * v;
      albedo[i * 4 + 3] = 255;
      const r = 0.82 + (m - 0.5) * 0.14 - Math.max(0, b - 0.6) * 0.16;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r * 255;
      rough[i * 4 + 3] = 255;
      height[i] = (m - 0.5) * 0.5 + (f - 0.5) * 0.12;
    }
  }
  return { map: toTexture(albedo, SIZE, true), normalMap: toTexture(normalFromHeight(height, SIZE), SIZE, false), roughnessMap: toTexture(rough, SIZE, false) };
}

let shared: SurfaceMaps | null = null;

/** Drawn on first use and kept, like the floor maps. */
export function sharedPlasterMaps(): SurfaceMaps {
  shared ??= plasterMaps();
  return shared;
}

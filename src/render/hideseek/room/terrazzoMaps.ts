import { Rng } from '@/engine/core/rng';
import { normalFromHeight, toTexture, valueNoise, type SurfaceMaps } from './mapTools';

/** Size of the floor texture, px. It covers FLOOR_TILE_METERS, so 256 px per meter: crisp on a 4K screen. */
const SIZE = 1024;
/** The texture spans 4 x 4 m of floor: four 2 m slabs. */
export const FLOOR_TILE_METERS = 4;
/** Distance between slab seams, px. */
const SLAB = SIZE / 2;
/** Half width of a seam, px. */
const SEAM = 1.6;

/**
 * Stone chips set in the floor, as sRGB colors with how common each is:
 * mostly pale and warm grey stone, a few blush and charcoal ones for life.
 */
const CHIPS: Array<[number, number, number, number]> = [
  [240, 239, 235, 0.42],
  [206, 203, 197, 0.3],
  [190, 187, 181, 0.14],
  [222, 208, 197, 0.1],
  [152, 150, 147, 0.04],
];
const BASE: [number, number, number] = [224, 221, 215];

function pickChip(r: number): [number, number, number, number] {
  let acc = 0;
  for (const c of CHIPS) {
    acc += c[3];
    if (r < acc) return c;
  }
  return CHIPS[0];
}

/** Distance in px to the nearest slab seam, 0 on the seam. */
function seamDistance(x: number, y: number): number {
  const dx = Math.min(x % SLAB, SLAB - (x % SLAB));
  const dy = Math.min(y % SLAB, SLAB - (y % SLAB));
  return Math.min(dx, dy);
}

/**
 * Polished warm terrazzo in 2 m slabs. The base is a pale cement with soft
 * clouding; thousands of small irregular stone chips are scattered through
 * it, a few larger ones among many tiny; thin seams split the slabs. The
 * surface is polished, so roughness is low everywhere but the seams.
 * Everything wraps, so the texture tiles without a visible edge.
 */
export function terrazzoMaps(seed = 17): SurfaceMaps {
  const rng = new Rng(seed);
  const cloud = valueNoise(rng, 6, SIZE);
  const grain = valueNoise(rng, 160, SIZE);
  const albedo = new Float32Array(SIZE * SIZE * 3);
  const rough = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const v = 1 + (cloud(x, y) - 0.5) * 0.05 + (grain(x, y) - 0.5) * 0.035 + (rng.next() - 0.5) * 0.02;
      albedo[i * 3] = BASE[0] * v;
      albedo[i * 3 + 1] = BASE[1] * v;
      albedo[i * 3 + 2] = BASE[2] * v;
      rough[i] = 0.3 + (cloud(x, y) - 0.5) * 0.08;
    }
  }
  scatterChips(rng, albedo, rough, 20000);
  const out = new Uint8ClampedArray(SIZE * SIZE * 4);
  const roughOut = new Uint8ClampedArray(SIZE * SIZE * 4);
  const height = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const s = seamDistance(i % SIZE, Math.floor(i / SIZE));
    const seam = s < SEAM + 1 ? Math.min(1, Math.max(0, SEAM + 1 - s)) : 0;
    const shade = 1 - seam * 0.16;
    out[i * 4] = albedo[i * 3] * shade;
    out[i * 4 + 1] = albedo[i * 3 + 1] * shade;
    out[i * 4 + 2] = albedo[i * 3 + 2] * shade;
    out[i * 4 + 3] = 255;
    roughOut[i * 4] = roughOut[i * 4 + 1] = roughOut[i * 4 + 2] = Math.min(1, rough[i] + seam * 0.45) * 255;
    roughOut[i * 4 + 3] = 255;
    height[i] = -seam * 0.9;
  }
  return { map: toTexture(out, SIZE, true), normalMap: toTexture(normalFromHeight(height, SIZE), SIZE, false), roughnessMap: toTexture(roughOut, SIZE, false) };
}

/**
 * Stamps `count` chips into the maps. Each chip is an irregular pebble,
 * a little stretched one way, with a soft edge one pixel wide; sizes follow a steep curve, so most are
 * specks and a few are pebbles. Chips are a touch glossier than the cement.
 */
function scatterChips(rng: Rng, albedo: Float32Array, rough: Float32Array, count: number): void {
  for (let n = 0; n < count; n++) {
    const cx = rng.next() * SIZE;
    const cy = rng.next() * SIZE;
    const r = 0.8 + Math.pow(rng.next(), 3.5) * 4.5;
    const [cr, cg, cb] = pickChip(rng.next());
    const tone = 1 + (rng.next() - 0.5) * 0.08;
    const p1 = rng.next() * 6.283;
    const p2 = rng.next() * 6.283;
    const p3 = rng.next() * 6.283;
    const stretch = rng.next() * 0.35;
    const reach = Math.ceil(r * 1.5) + 1;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const px = Math.floor(cx) + dx;
        const py = Math.floor(cy) + dy;
        const ox = px + 0.5 - cx;
        const oy = py + 0.5 - cy;
        const a = Math.atan2(oy, ox);
        const edge = r * (1 + stretch * Math.sin(2 * a + p1) + 0.12 * Math.sin(3 * a + p2) + 0.07 * Math.sin(5 * a + p3));
        const cover = Math.min(1, Math.max(0, edge - Math.hypot(ox, oy) + 0.5));
        if (cover <= 0) continue;
        const i = ((py + SIZE) % SIZE) * SIZE + ((px + SIZE) % SIZE);
        albedo[i * 3] += (cr * tone - albedo[i * 3]) * cover;
        albedo[i * 3 + 1] += (cg * tone - albedo[i * 3 + 1]) * cover;
        albedo[i * 3 + 2] += (cb * tone - albedo[i * 3 + 2]) * cover;
        rough[i] -= 0.06 * cover;
      }
    }
  }
}

let shared: SurfaceMaps | null = null;

/**
 * The floor maps, drawn the first time a showcase opens and kept for the
 * page's life. Drawing them takes a noticeable moment, which would land on
 * every focus change if each showcase drew its own.
 */
export function sharedFloorMaps(): SurfaceMaps {
  shared ??= terrazzoMaps();
  return shared;
}

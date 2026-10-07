import { Rng } from '@/engine/core/rng';
import { fbm, smoothstep } from '../noise';
import { flatRadius, rockiness, terrainHeight, type TerrainShape } from '../terrain/terrainHeight';
import { distanceAt, insideAt } from '../trackField';
import { padWeight } from '../../stadium/layout';

/** Floats per placed item: x, y, z, scale, yaw, tint, variant, lean. */
export const STRIDE = 8;

/** Seeded positions for everything that grows or lies on the hills. */
export interface Flora {
  pines: Float32Array;
  broadleaf: Float32Array;
  shrubs: Float32Array;
  rocks: Float32Array;
}

/** Ground slope at a point, 0 flat to 1 vertical, from the height function itself. */
function slopeAt(shape: TerrainShape, x: number, z: number): number {
  const e = 2;
  const dx = terrainHeight(shape, x + e, z) - terrainHeight(shape, x - e, z);
  const dz = terrainHeight(shape, x, z + e) - terrainHeight(shape, x, z - e);
  return 1 - 1 / Math.hypot(dx / (2 * e), dz / (2 * e), 1);
}

/** True when a point sits on a building pad or close to one. */
function onPad(shape: TerrainShape, x: number, z: number): boolean {
  return shape.pads.some((p) => padWeight(p, x, z, 10) > 0.02);
}

/**
 * Where trees, shrubs and rocks go. Everything keeps clear of the road's
 * shelf and the building pads, so no car can ever appear to drive through
 * a trunk. Trees gather in groves from a low frequency noise, pines prefer
 * the higher slopes and broadleaf trees the hollows; rocks crowd onto the
 * sandstone spines. Most items sit within a few hundred meters of the road,
 * where a camera can actually see them.
 */
export function placeFlora(shape: TerrainShape): Flora {
  const f = shape.field;
  const rng = new Rng(shape.seed ^ 0x7ee5);
  const clear = flatRadius(f) + 6;
  const reachX = f.extentX + 520;
  const reachZ = f.extentZ + 520;
  const pines: number[] = [];
  const broad: number[] = [];
  const shrubs: number[] = [];
  const rocks: number[] = [];
  const push = (out: number[], x: number, z: number, scale: number, variant: number, lean = 0) =>
    out.push(x, terrainHeight(shape, x, z), z, scale, rng.range(0, Math.PI * 2), rng.next(), variant, lean);

  for (let k = 0; k < 26000; k++) {
    const x = f.centerX + rng.range(-reachX, reachX);
    const z = f.centerZ + rng.range(-reachZ, reachZ);
    const d = distanceAt(f, x, z);
    if (d < clear || onPad(shape, x, z)) continue;
    // Density falls off with distance from the road: far hills only need a scatter for their silhouette.
    const near = (1 - smoothstep(120, 640, d) * 0.8) * (1 + (1 - smoothstep(30, 110, d)) * 0.8);
    const grove = smoothstep(0.42, 0.7, fbm(x / 130, z / 130, shape.seed + 41, 3));
    const rock = rockiness(shape, x, z);
    const roll = rng.next();
    if (roll < 0.11 * near * (0.25 + grove) && rock < 0.55) {
      const slope = slopeAt(shape, x, z);
      if (slope > 0.42) continue;
      const y = terrainHeight(shape, x, z);
      const pine = rng.next() < (insideAt(f, x, z) ? 0.45 : 0.62 + smoothstep(2, 30, y) * 0.3);
      // Big trees close to the road, a mix of heights everywhere.
      const scale = rng.range(0.75, 1.35) * (pine ? 1 : 0.95);
      push(pine ? pines : broad, x, z, scale, rng.next() < 0.5 ? 0 : 1, slope);
    } else if (roll < 0.2 * near) {
      push(shrubs, x, z, rng.range(0.55, 1.5), rng.next() < 0.5 ? 0 : 1);
    } else if (roll < 0.2 * near + 0.05 * (0.15 + rock) * near) {
      // Boulders, a few of them huge where the spines break the surface.
      // Big boulders only well away from the road, where they read as part of the hillside.
      const big = rock > 0.5 && d > 70 && rng.next() < 0.18;
      push(rocks, x, z, big ? rng.range(3.5, 9) : rng.range(0.5, 2.2), rng.next() < 0.5 ? 0 : 1, slopeAt(shape, x, z));
    }
  }
  return { pines: Float32Array.from(pines), broadleaf: Float32Array.from(broad), shrubs: Float32Array.from(shrubs), rocks: Float32Array.from(rocks) };
}

import type * as THREE from 'three';
import { hash, packNormal, pixelTexture } from './pixels';
import { tileFbm } from './tileNoise';

/** Meters covered by one tile of each texture. Materials set their repeat from these. */
export const ASPHALT_TILE = 4;
export const PAVING_TILE = 3;

/** Asphalt surface height at a texel: fine aggregate plus the odd stone and pit. */
function asphaltHeight(x: number, y: number, size: number): number {
  const u = x / size;
  const v = y / size;
  const grain = tileFbm(u * 96, v * 96, 96, 7, 3);
  const cell = 3;
  const s = hash(Math.floor(x / cell), Math.floor(y / cell), 11);
  const stone = s > 0.955 ? 0.35 : s < 0.03 ? -0.35 : 0;
  return grain + stone;
}

/** Height of a sidewalk texel: flat slabs with sunken joints between them and a faint grain. */
function pavingHeight(x: number, y: number, size: number): number {
  const per = size / 4;
  const jx = Math.min(x % per, per - (x % per));
  const jy = Math.min(y % per, per - (y % per));
  const joint = Math.min(jx, jy);
  const groove = joint < 1.5 ? -1 : joint < 3 ? -0.4 * (3 - joint) / 1.5 : 0;
  return groove + tileFbm(x / size * 48, y / size * 48, 48, 3, 2) * 0.25;
}

/** A normal map from a height function by central differences, tiling. */
function normalFrom(name: string, size: number, height: (x: number, y: number, size: number) => number, strength: number): THREE.DataTexture {
  return pixelTexture(name, size, false, (x, y, out) => {
    const l = height((x - 1 + size) % size, y, size);
    const r = height((x + 1) % size, y, size);
    const d = height(x, (y - 1 + size) % size, size);
    const u = height(x, (y + 1) % size, size);
    packNormal((l - r) * strength, (d - u) * strength, out);
  });
}

/**
 * Asphalt: a dark grey binder with lighter aggregate showing through, the
 * odd bright stone and dark pit. Roughness rides in the green channel of
 * its own map (three reads it from there), stones a little smoother.
 */
export function asphaltMaps(size: number): { map: THREE.DataTexture; normal: THREE.DataTexture; rough: THREE.DataTexture } {
  const map = pixelTexture('asphalt', size, true, (x, y, out) => {
    const h = asphaltHeight(x, y, size);
    const tint = tileFbm((x / size) * 6, (y / size) * 6, 6, 5, 3);
    const v = 78 + h * 30 + (tint - 0.5) * 16;
    out[0] = Math.max(0, Math.min(255, v + 7));
    out[1] = Math.max(0, Math.min(255, v + 4));
    out[2] = Math.max(0, Math.min(255, v - 1));
  });
  const rough = pixelTexture('asphalt-rough', size, false, (x, y, out) => {
    const h = asphaltHeight(x, y, size);
    const g = Math.round((0.9 - Math.max(0, h - 0.6) * 0.35) * 255);
    out[0] = out[1] = out[2] = g;
  });
  return { map, normal: normalFrom('asphalt-normal', size, asphaltHeight, 1.6), rough };
}

/**
 * Sidewalk slabs: four by four warm grey concrete squares per tile, each
 * a slightly different shade, with dark sunken joints between them.
 */
export function pavingMaps(size: number): { map: THREE.DataTexture; normal: THREE.DataTexture } {
  const per = size / 4;
  const map = pixelTexture('paving', size, true, (x, y, out) => {
    const h = pavingHeight(x, y, size);
    const slab = hash(Math.floor(x / per), Math.floor(y / per), 21);
    const speck = hash(x, y, 4) > 0.97 ? -14 : 0;
    const stain = tileFbm((x / size) * 3, (y / size) * 3, 3, 9, 3);
    const v = 168 + (slab - 0.5) * 18 + h * 40 + speck + (stain - 0.5) * 22;
    out[0] = Math.max(0, Math.min(255, v + 8));
    out[1] = Math.max(0, Math.min(255, v + 2));
    out[2] = Math.max(0, Math.min(255, v - 9));
  });
  return { map, normal: normalFrom('paving-normal', size, pavingHeight, 2.2) };
}

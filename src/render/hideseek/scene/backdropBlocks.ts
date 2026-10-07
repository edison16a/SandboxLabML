import { bakeOcclusion } from './cityShade';

/** One block of the city: a footprint on the ground, a height and a tone from 0 (lightest) to 1. */
export interface BackdropBlock {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone: number;
}

/** Half size of the square the city may cover, m. */
export const BACKDROP_HALF = 400;
/** Ground kept clear round the arenas before the first blocks, m: a narrow lane, so the city hugs the outer walls. */
export const CITY_MARGIN = 0.8;
/** How far out from that lane blocks still stand, m. The haze is full by then (see haze.ts). */
export const CITY_REACH = 200;
/** Levels of the quadtree: a top cell is 2^LEVELS finest cells across. */
const LEVELS = 3;
/** Below these distances from the clear area, m, a cell of level 1, 2 and 3 splits into four. Scaled with the finest cell. */
const SPLIT = [0, 20, 45, 90];
/** Height steps, m: heights snap to these, so neighbors line up into terraces like stacked cubes. */
const STEP = 0.5;

/** A repeatable hash of a lattice point, 0 to 1. */
function hash(i: number, j: number, salt: number): number {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(salt, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise with a cell of `cell` m, 0 to 1, so tall blocks gather into districts instead of standing alone. */
function districts(x: number, z: number, cell: number): number {
  const fx = x / cell;
  const fz = z / cell;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const su = u * u * (3 - 2 * u);
  const sv = v * v * (3 - 2 * v);
  const top = hash(i, j, 7) + (hash(i + 1, j, 7) - hash(i, j, 7)) * su;
  const bottom = hash(i, j + 1, 7) + (hash(i + 1, j + 1, 7) - hash(i, j + 1, 7)) * su;
  return top + (bottom - top) * sv;
}

/**
 * How tall a block may stand at `distance` m from the clear area round the
 * arenas, 0 to 1: blocks right by an arena stay below its walls so they
 * never hide it, and the skyline rises with distance.
 */
export function heightRamp(distance: number): number {
  return Math.min(1, 0.22 + distance / 30);
}

/** Distance from (x, z) to the rectangle |x| <= hx, |z| <= hz, 0 inside it. */
export function distanceToClear(x: number, z: number, hx: number, hz: number): number {
  return Math.hypot(Math.max(0, Math.abs(x) - hx), Math.max(0, Math.abs(z) - hz));
}

/** Distance from the square cell at (x0, z0) of side `s` to the rectangle |x| <= hx, |z| <= hz, 0 if they touch. */
function cellDistance(x0: number, z0: number, s: number, hx: number, hz: number): number {
  const dx = Math.max(0, x0 - hx, -hx - (x0 + s));
  const dz = Math.max(0, z0 - hz, -hz - (z0 + s));
  return Math.hypot(dx, dz);
}

/**
 * The city round arenas that cover |x| <= hx, |z| <= hz: a dense field of
 * grey blocks of many heights, packed edge to edge like the cube cities of
 * the hide and seek classics. It is a quadtree, so blocks are `base` m
 * across next to the arenas and up to eight times that far out, which
 * keeps a city stretching to the horizon to a few thousand blocks. The same
 * spot always gets the same block, so the city stays put as the grid grows.
 */
export function cityBlocks(hx: number, hz: number, base: number, limit = 8000): BackdropBlock[] {
  const out: BackdropBlock[] = [];
  const cx = hx + CITY_MARGIN;
  const cz = hz + CITY_MARGIN;
  const reach = Math.min(BACKDROP_HALF, Math.max(cx, cz) + CITY_REACH);
  const top = base * 2 ** LEVELS;
  const scale = base / 2.5;
  const visit = (x0: number, z0: number, size: number, level: number): void => {
    if (out.length >= limit) return;
    const gap = cellDistance(x0, z0, size, cx, cz);
    if (gap > CITY_REACH || Math.abs(x0 + size / 2) > reach || Math.abs(z0 + size / 2) > reach) return;
    if (level > 0 && (gap === 0 || gap < SPLIT[level] * scale)) {
      const half = size / 2;
      for (let k = 0; k < 4; k++) visit(x0 + (k & 1) * half, z0 + (k >> 1) * half, half, level - 1);
      return;
    }
    if (gap === 0) return;
    const i = Math.round(x0 / base);
    const j = Math.round(z0 / base);
    // Some cells hold two or four smaller blocks, so the city is not one even lattice.
    const split = hash(i, j, 4);
    const half = size / 2;
    if (split < 0.2) for (let k = 0; k < 4; k++) block(x0 + (k & 1) * half, z0 + (k >> 1) * half, half, half, gap, i * 4 + k, j);
    else if (split < 0.32) for (let k = 0; k < 2; k++) block(x0 + k * half, z0, half, size, gap, i * 4 + k, j);
    else if (split < 0.44) for (let k = 0; k < 2; k++) block(x0, z0 + k * half, size, half, gap, i * 4 + k, j);
    else block(x0, z0, size, size, gap, i * 4, j);
  };
  /** One block filling the w by d cell at (x0, z0), with its own height and tone from the cell's hash. */
  const block = (x0: number, z0: number, w: number, d: number, gap: number, i: number, j: number): void => {
    const r = hash(i, j, 1);
    const lift = Math.pow(districts(x0, z0, 46), 1.5);
    const raw = (0.4 + lift * 10 + r * r * 4.5) * heightRamp(gap) * (0.7 + 0.3 * scale);
    // Right by the walls nothing stands above them, or it would hide the room.
    const h = Math.min(gap < 3 ? 2.2 : Infinity, Math.max(STEP * 0.6, Math.round(raw / STEP) * STEP));
    const inset = Math.min(w, d) * (0.015 + hash(i, j, 2) * 0.025);
    out.push({ x: x0 + w / 2, z: z0 + d / 2, w: w - inset, d: d - inset, h, tone: hash(i, j, 3) });
  };
  const n = Math.ceil(reach / top);
  for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) visit(i * top, j * top, top, LEVELS);
  bakeOcclusion(out, base);
  return out;
}

/** The finest block size for a grid of `count` arenas, m: bigger blocks for the wide grids, which are seen from much further away. */
export function cityBase(count: number): number {
  return count <= 1 ? 2 : count <= 9 ? 3.5 : 7;
}

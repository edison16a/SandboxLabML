import { Rng } from '@/engine/core/rng';

/** One block of the backdrop: a footprint on the floor, a height and a tone from 0 (lightest) to 1. */
export interface BackdropBlock {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone: number;
}

/** Spacing of the block lattice, m. Blocks are smaller than a cell, so lanes open up between them. */
const CELL = 11;
/** Half size of the square the blocks are scattered over, m. */
export const BACKDROP_HALF = 270;

/** Smooth noise on a coarse grid, so tall blocks cluster into districts instead of standing alone. */
function districts(rng: Rng, cells: number, span: number): (x: number, z: number) => number {
  const grid = Float32Array.from({ length: (cells + 1) * (cells + 1) }, () => rng.next());
  return (x, z) => {
    const fx = ((x / span + 0.5) * cells);
    const fz = ((z / span + 0.5) * cells);
    const i = Math.max(0, Math.min(cells - 1, Math.floor(fx)));
    const j = Math.max(0, Math.min(cells - 1, Math.floor(fz)));
    const u = fx - i;
    const v = fz - j;
    const at = (a: number, b: number) => grid[b * (cells + 1) + a];
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * u;
    const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
    return top + (bottom - top) * v;
  };
}

/**
 * The candidate blocks of the backdrop, the same every time for a seed: a
 * jittered lattice of blocks of varied size whose height follows a smooth
 * noise. Which of them show, and how tall, depends on where the arenas
 * are; the Backdrop component decides that.
 */
export function backdropBlocks(seed = 5): BackdropBlock[] {
  const rng = new Rng(seed);
  const noise = districts(rng, 9, BACKDROP_HALF * 2);
  const out: BackdropBlock[] = [];
  const n = Math.floor((BACKDROP_HALF * 2) / CELL);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const w = 4 + rng.next() * 5.5;
      const d = 4 + rng.next() * 5.5;
      const x = -BACKDROP_HALF + (i + 0.5) * CELL + (rng.next() - 0.5) * (CELL - w) * 0.8;
      const z = -BACKDROP_HALF + (j + 0.5) * CELL + (rng.next() - 0.5) * (CELL - d) * 0.8;
      const lift = noise(x, z);
      const h = 1 + Math.pow(lift, 1.4) * 13 * (0.5 + rng.next() * 0.5);
      out.push({ x, z, w, d, h, tone: rng.next() });
    }
  }
  return out;
}

/**
 * How tall a block may stand at `distance` m from the clear area round the
 * arenas, 0 to 1: blocks right by an arena stay low so they never hide it,
 * and the skyline rises with distance.
 */
export function heightRamp(distance: number): number {
  return Math.min(1, 0.2 + distance / 70);
}

/** Distance from (x, z) to the rectangle |x| <= hx, |z| <= hz, 0 inside it. */
export function distanceToClear(x: number, z: number, hx: number, hz: number): number {
  return Math.hypot(Math.max(0, Math.abs(x) - hx), Math.max(0, Math.abs(z) - hz));
}

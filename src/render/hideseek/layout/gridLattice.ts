import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';

const ARENA = DEFAULT_HIDESEEK_PHYSICS.arena;

/** Outside width of one arena, outer walls included, m. */
export const ARENA_SPAN = ARENA.size + 2 * ARENA.outerWallThickness;

/** Empty floor between neighboring arenas, m. */
export const ARENA_GAP = 4;

/** How a number of arenas is laid out on the floor. */
export interface Lattice {
  count: number;
  cols: number;
  rows: number;
  /** Distance between neighboring arena centers, m. */
  pitch: number;
  /** Outside size of the whole grid, m. */
  width: number;
  depth: number;
}

/**
 * Columns and rows for `n` arenas on a viewport of the given aspect ratio
 * (width over height). Fifty arenas are 10 x 5 on a wide viewport and
 * 5 x 10 on a tall one; other counts are as square as they can be, with the
 * extra column on the long side of the screen.
 */
export function gridDims(n: number, aspect: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  const wide = aspect >= 1;
  if (n === 50) return wide ? { cols: 10, rows: 5 } : { cols: 5, rows: 10 };
  const long = Math.ceil(Math.sqrt(n));
  const short = Math.ceil(n / long);
  return wide ? { cols: long, rows: short } : { cols: short, rows: long };
}

export function latticeFor(n: number, aspect: number, gap = ARENA_GAP): Lattice {
  const count = Math.max(1, n);
  const { cols, rows } = gridDims(count, aspect);
  const pitch = ARENA_SPAN + gap;
  return { count, cols, rows, pitch, width: cols * pitch - gap, depth: rows * pitch - gap };
}

/**
 * Floor position of arena `i`'s center. Arenas fill rows left to right,
 * top (far, -z) to bottom, and the whole grid is centered on the origin.
 */
export function arenaOrigin(i: number, lattice: Lattice, out: { x: number; z: number }): { x: number; z: number } {
  const col = i % lattice.cols;
  const row = Math.floor(i / lattice.cols);
  out.x = (col - (lattice.cols - 1) / 2) * lattice.pitch;
  out.z = (row - (lattice.rows - 1) / 2) * lattice.pitch;
  return out;
}

/** Index of the arena whose floor contains (x, z), or -1 for the gaps and outside. */
export function arenaAt(x: number, z: number, lattice: Lattice): number {
  const fx = x / lattice.pitch + (lattice.cols - 1) / 2;
  const fz = z / lattice.pitch + (lattice.rows - 1) / 2;
  const col = Math.round(fx);
  const row = Math.round(fz);
  if (col < 0 || row < 0 || col >= lattice.cols || row >= lattice.rows) return -1;
  const half = ARENA_SPAN / 2 / lattice.pitch;
  if (Math.abs(fx - col) > half || Math.abs(fz - row) > half) return -1;
  const i = row * lattice.cols + col;
  return i < lattice.count ? i : -1;
}

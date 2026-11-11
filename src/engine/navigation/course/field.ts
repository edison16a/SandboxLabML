import { CellHeap } from './heap';
import type { Rect } from './types';

/**
 * Walking distance to the finish over a grid of the room. Cells whose
 * center an agent could not stand on (too close to a solid or to spikes)
 * are blocked. It is worked out once per course and used three ways: as
 * progress for fitness, as the path hint input, and by the renderer for
 * the dotted trail.
 */
export interface DistanceField {
  /** Side of one cell, m. */
  cell: number;
  nx: number;
  nz: number;
  /** World position of the center of cell (0, 0). */
  x0: number;
  z0: number;
  /** Meters to walk from each cell's center to the finish line, Infinity where blocked. */
  dist: Float32Array;
  /** Unit direction to walk from each cell, a short way down the field. Zero where blocked. */
  flowX: Float32Array;
  flowZ: Float32Array;
}

export interface FieldInput {
  length: number;
  width: number;
  finishX: number;
  /** Inner solids (walls and blocks). The outer walls are the room's own edge. */
  solids: readonly Rect[];
  spikes: readonly Rect[];
  /** How close a cell center may come to a solid, and to spikes, m. */
  solidMargin: number;
  spikeMargin: number;
  cell: number;
}

/** Distance from (x, z) to rectangle r, 0 inside it. */
export function rectDistance(x: number, z: number, r: Rect): number {
  const dx = Math.max(0, Math.abs(x - r.x) - r.hx);
  const dz = Math.max(0, Math.abs(z - r.z) - r.hz);
  return Math.hypot(dx, dz);
}

/** Neighbor steps of the search: four straight, four diagonal and eight knight moves, so paths come out nearly straight. */
const STEPS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
  [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2],
];
/** Cells of the lookahead that sets each cell's flow direction. */
const LOOKAHEAD = 6;

/** Builds the field: marks blocked cells, then runs Dijkstra outward from the finish line. */
export function buildField(input: FieldInput): DistanceField {
  const { length, width, finishX, cell } = input;
  const nx = Math.ceil(length / cell);
  const nz = Math.ceil(width / cell);
  const x0 = -length / 2 + cell / 2;
  const z0 = -width / 2 + cell / 2;
  const n = nx * nz;
  // The search runs in doubles: float rounding between a key and its stored distance would let a cell be settled twice.
  const dist = new Float64Array(n).fill(Infinity);
  const open = new Uint8Array(n);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * cell;
      const z = z0 + j * cell;
      const edge = Math.min(x + length / 2, length / 2 - x, z + width / 2, width / 2 - z);
      let ok = edge > input.solidMargin;
      for (let k = 0; ok && k < input.solids.length; k++) ok = rectDistance(x, z, input.solids[k]) > input.solidMargin;
      for (let k = 0; ok && k < input.spikes.length; k++) ok = rectDistance(x, z, input.spikes[k]) > input.spikeMargin;
      open[j * nx + i] = ok ? 1 : 0;
    }
  }
  const heap = new CellHeap(n * (STEPS.length + 1));
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * cell;
      const c = j * nx + i;
      if (open[c] && x >= finishX - cell) {
        dist[c] = Math.max(0, finishX - x);
        heap.push(c, dist[c]);
      }
    }
  }
  const isOpen = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < nz && open[j * nx + i] === 1;
  while (heap.size > 0) {
    const key = heap.peekKey();
    const c = heap.pop();
    if (key > dist[c]) continue;
    const i = c % nx;
    const j = (c - i) / nx;
    for (const [di, dj] of STEPS) {
      const ti = i + di;
      const tj = j + dj;
      if (!isOpen(ti, tj) || !passable(isOpen, i, j, di, dj)) continue;
      const t = tj * nx + ti;
      const d = key + Math.hypot(di, dj) * cell;
      if (d < dist[t]) {
        dist[t] = d;
        heap.push(t, d);
      }
    }
  }
  const field: DistanceField = { cell, nx, nz, x0, z0, dist: Float32Array.from(dist), flowX: new Float32Array(n), flowZ: new Float32Array(n) };
  bakeFlow(field, isOpen);
  return field;
}

/** A diagonal or knight step may not cut the corner of a blocked cell. */
function passable(isOpen: (i: number, j: number) => boolean, i: number, j: number, di: number, dj: number): boolean {
  if (Math.abs(di) + Math.abs(dj) === 1) return true;
  if (Math.abs(di) === 1 && Math.abs(dj) === 1) return isOpen(i + di, j) && isOpen(i, j + dj);
  const si = Math.sign(di);
  const sj = Math.sign(dj);
  return Math.abs(di) === 2 ? isOpen(i + si, j) && isOpen(i + si, j + sj) : isOpen(i, j + sj) && isOpen(i + si, j + sj);
}

/**
 * Each open cell's flow points at where steepest descent leads a few
 * cells on. Looking ahead rather than at the next cell smooths out the
 * grid's 45 degree steps, so the hint turns gently round corners.
 */
function bakeFlow(f: DistanceField, isOpen: (i: number, j: number) => boolean): void {
  for (let j = 0; j < f.nz; j++) {
    for (let i = 0; i < f.nx; i++) {
      const c = j * f.nx + i;
      if (!Number.isFinite(f.dist[c])) continue;
      let ci = i;
      let cj = j;
      for (let s = 0; s < LOOKAHEAD; s++) {
        let best = f.dist[cj * f.nx + ci];
        let bi = -1;
        let bj = -1;
        for (let k = 0; k < 8; k++) {
          const [di, dj] = STEPS[k];
          const ti = ci + di;
          const tj = cj + dj;
          if (!isOpen(ti, tj) || !passable(isOpen, ci, cj, di, dj)) continue;
          const d = f.dist[tj * f.nx + ti];
          if (d < best - 1e-6) {
            best = d;
            bi = ti;
            bj = tj;
          }
        }
        if (bi < 0) break;
        ci = bi;
        cj = bj;
      }
      let fx = ci - i;
      const fz = cj - j;
      // Past the line, or a cell with nowhere lower to go: just head for the finish.
      if (fx === 0 && fz === 0) fx = 1;
      const len = Math.hypot(fx, fz);
      f.flowX[c] = fx / len;
      f.flowZ[c] = fz / len;
    }
  }
}

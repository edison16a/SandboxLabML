import type * as THREE from 'three';
import { onCap } from './cap';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Pt } from './section';

/**
 * A panel laid on the nose (end 1) or the tail (end -1): rows across z,
 * columns up y, every point pushed through the same warp as the body, so
 * lamps and intakes sit exactly on the curved face. `zAt(y)` gives the
 * panel's half width at a height, which makes trapezoids and tapers easy.
 * When `mirror` the panel is built on the left and copied to the right.
 */
export function capPanel(end: 1 | -1, z0: (y: number) => number, z1: (y: number) => number, y0: number, y1: number, lift: number, cols = 6, rows = 3, mirror = true): THREE.BufferGeometry {
  return capSpan(end, (u) => [z0(y0) + (z1(y0) - z0(y0)) * u, y0], (u) => [z0(y1) + (z1(y1) - z0(y1)) * u, y1], lift, cols, rows, mirror, (u, v) => {
    const y = y0 + (y1 - y0) * v;
    return [z0(y) + (z1(y) - z0(y)) * u, y];
  });
}

/** A constant half width, for capPanel. */
export const at = (v: number) => () => v;

/**
 * A panel on the nose or tail between a lower edge `lo(u)` and an upper
 * edge `hi(u)`, both walked with z rising as u goes from 0 to 1. Slanted
 * lamps and intakes that follow the face's outline are easiest this way.
 * `inside` overrides the straight blend between the edges.
 */
export function capSpan(end: 1 | -1, lo: (u: number) => Pt, hi: (u: number) => Pt, lift: number, cols = 6, rows = 2, mirror = true, inside?: (u: number, v: number) => Pt): THREE.BufferGeometry {
  const grid: Vec3[][] = [];
  for (let i = 0; i <= cols; i++) {
    const u = i / cols;
    const a = lo(u);
    const b = hi(u);
    const row: Vec3[] = [];
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      const [z, y] = inside ? inside(u, v) : [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v];
      row.push(onCap(end, z, y, lift));
    }
    grid.push(row);
  }
  // Rows run along +z and columns up +y, and z cross y faces -x: right for the tail, flipped for the nose.
  const g = gridGeometry(end > 0 ? grid.reverse() : grid);
  return mirror ? bothSides(g) : g;
}

/** A round disc on the nose or tail, for lamp dots, lenses and the like. */
export function capDisc(end: 1 | -1, cz: number, cy: number, r: number, lift: number, segments = 16, mirror = true, squash = 1): THREE.BufferGeometry {
  const grid: Vec3[][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    grid.push([onCap(end, cz, cy, lift), onCap(end, cz + Math.cos(a) * r, cy + Math.sin(a) * r * squash, lift)]);
  }
  // Rows walk counterclockwise in (z, y) and columns run out from the center, which faces +x: the nose's way.
  const g = gridGeometry(end > 0 ? grid : grid.reverse());
  return mirror ? bothSides(g) : g;
}

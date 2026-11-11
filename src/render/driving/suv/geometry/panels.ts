import type * as THREE from 'three';
import { onCap } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';

/**
 * A panel laid on the nose (end 1) or the tail (end -1): rows across z,
 * columns up y, every point pushed through the same warp as the body, so
 * lamps and grilles sit exactly on the curved face. `zAt(y)` gives the
 * panel's half width at a height, which makes trapezoids and tapers easy.
 * When `mirror` the panel is built on the left and copied to the right.
 */
export function capPanel(end: 1 | -1, z0: (y: number) => number, z1: (y: number) => number, y0: number, y1: number, lift: number, cols = 6, rows = 3, mirror = true): THREE.BufferGeometry {
  const grid: Vec3[][] = [];
  for (let i = 0; i <= cols; i++) {
    const row: Vec3[] = [];
    for (let j = 0; j <= rows; j++) {
      const y = y0 + ((y1 - y0) * j) / rows;
      const a = z0(y);
      const b = z1(y);
      row.push(onCap(end, a + ((b - a) * i) / cols, y, lift));
    }
    grid.push(row);
  }
  // Rows run along +z and columns up +y, and z cross y faces -x: right for the tail, flipped for the nose.
  const g = gridGeometry(end > 0 ? grid.reverse() : grid);
  return mirror ? bothSides(g) : g;
}

/** A constant half width, for capPanel. */
export const at = (v: number) => () => v;

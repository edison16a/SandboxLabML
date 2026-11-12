import type * as THREE from 'three';
import { gridGeometry, type Vec3 } from '../../suv/geometry/grid';
import type { Region } from '../shape/types';
import type { Projector } from './project';
import { growGrid, laidParams, regionGrid } from './region';
import type { Pt } from './section';

/**
 * Lays a grid of view plane points onto the body `lift` meters proud of
 * it, facing out, with the body's own normals. Misses take their
 * neighbor's place and are counted.
 */
function lay(proj: Projector, r: Region, flat: Pt[][], lift: number): { geometry: THREE.BufferGeometry; misses: number } {
  let misses = 0;
  let last = { p: [0, 0, 0] as Vec3, n: [0, 0, 1] as Vec3 };
  const normals: Vec3[][] = [];
  const rows = flat.map((row) => {
    const ns: Vec3[] = [];
    normals.push(ns);
    return row.map(([a, b]) => {
      const h = proj.hit(r.view, a, b);
      if (!h) misses++;
      last = h ?? last;
      ns.push(last.n);
      return [last.p[0] + last.n[0] * lift, last.p[1] + last.n[1] * lift, last.p[2] + last.n[2] * lift] as Vec3;
    });
  });
  let g = gridGeometry(rows);
  const i = flat.length >> 1;
  const j = flat[0].length >> 1;
  const n = g.attributes.normal;
  const mid = normals[i][j];
  const c = i * flat[0].length + j;
  const flip = n.getX(c) * mid[0] + n.getY(c) * mid[1] + n.getZ(c) * mid[2] < 0;
  if (flip) {
    g.dispose();
    g = gridGeometry(rows.map((row) => [...row].reverse()));
  }
  const out = g.attributes.normal;
  normals.forEach((ns, a) => (flip ? [...ns].reverse() : ns).forEach((v, b) => out.setXYZ(a * ns.length + b, v[0], v[1], v[2])));
  return { geometry: g, misses };
}

/**
 * A small piece laid just proud of the body as its own thin sheet: a lit
 * strip inside a lamp, a plate, a shut line. Cheaper than stamping for
 * thin shapes, and safe where the paint under it is gently curved.
 */
export function floatDecal(proj: Projector, r: Region, nu: number, nv: number, lift: number): { geometry: THREE.BufferGeometry; misses: number } {
  return lay(proj, r, regionGrid(r, laidParams(proj, r, nu, true), laidParams(proj, r, nv, false)), lift);
}

/**
 * A thin dark frame round a region: a ring from just inside its outline
 * out to `grow` beyond it, laid a hair proud. Every point of the ring
 * sits on the outline, so it hugs the body however coarse the shell is.
 */
export function ringDecal(proj: Projector, r: Region, nu: number, nv: number, grow: number, lift: number): { geometry: THREE.BufferGeometry; misses: number } {
  const us = laidParams(proj, r, nu, true);
  const vs = laidParams(proj, r, nv, false);
  const inner = regionGrid(r, us, vs);
  const outer = regionGrid(r, us, vs);
  growGrid(inner, -0.004);
  growGrid(outer, grow);
  const zi: 0 | 1 | null = r.view === 'top' ? 1 : r.view === 'side' ? null : 0;
  if (zi !== null) for (const row of outer) for (const p of row) p[zi] = Math.max(0, p[zi]);
  const loop = (g: Pt[][]): Pt[] => {
    const a = g.length - 1;
    const b = g[0].length - 1;
    return [...g.map((row) => row[0]), ...g[a].slice(1), ...g.slice(0, a).reverse().map((row) => row[b]), ...g[0].slice(1, b).reverse()];
  };
  const lo = loop(outer);
  const rows = loop(inner).map((p, k) => [p, lo[k]]);
  // No frame runs along the centerline, where the glass meets its own mirror image: start the
  // strip just after that stretch and stop just before it, so the frame is open there.
  const onCenter = (k: number) => zi !== null && rows[k][1][zi] < 1e-4 && rows[(k + 1) % rows.length][1][zi] < 1e-4;
  const n = rows.length;
  const start = rows.findIndex((_, k) => onCenter((k - 1 + n) % n) && !onCenter(k));
  const strip = start < 0 ? [...rows, rows[0]] : Array.from({ length: n }, (_, k) => rows[(start + k) % n]).filter((_, k) => !onCenter((start + k) % n) || !onCenter((start + k - 1 + n) % n));
  return lay(proj, r, strip, lift);
}

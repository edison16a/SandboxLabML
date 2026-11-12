import type { Region } from '../shape/types';
import type { Projector } from './project';
import { sampler, type Pt } from './section';

/**
 * A Coons patch over a region: rows run along the bottom and top curves
 * (u), columns from bottom to top (v). Interior points blend all four
 * boundary curves, so any rounded or pointed outline fills smoothly.
 */
export function regionGrid(r: Region, us: readonly number[], vs: readonly number[]): Pt[][] {
  const b = r.bottom;
  const t = r.top;
  const l = r.left ?? [b[0], t[0]];
  const rt = r.right ?? [b[b.length - 1], t[t.length - 1]];
  const b0 = b[0], b1 = b[b.length - 1], t0 = t[0], t1 = t[t.length - 1];
  const [sb, st, sl, sr] = [b, t, l, rt].map(sampler);
  const left = vs.map(sl);
  const right = vs.map(sr);
  const rows: Pt[][] = [];
  for (const u of us) {
    const cb = sb(u);
    const ct = st(u);
    const row: Pt[] = [];
    for (let j = 0; j < vs.length; j++) {
      const v = vs[j];
      const dl = left[j];
      const dr = right[j];
      const p: Pt = [0, 0];
      for (let k = 0; k < 2; k++) {
        const corner = (1 - u) * (1 - v) * b0[k] + u * (1 - v) * b1[k] + (1 - u) * v * t0[k] + u * v * t1[k];
        p[k] = (1 - v) * cb[k] + v * ct[k] + (1 - u) * dl[k] + u * dr[k] - corner;
      }
      row.push(p);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Pushes a grid's outline out by `m` in its own plane: each boundary
 * point moves along the outline's outward normal. Points that coincide at
 * a pointed end move together along the end's bisector.
 */
export function growGrid(rows: Pt[][], m: number): void {
  const nu = rows.length - 1;
  const nv = rows[0].length - 1;
  const loop: Array<[number, number]> = [];
  for (let i = 0; i <= nu; i++) loop.push([i, 0]);
  for (let j = 1; j <= nv; j++) loop.push([nu, j]);
  for (let i = nu - 1; i >= 0; i--) loop.push([i, nv]);
  for (let j = nv - 1; j >= 1; j--) loop.push([0, j]);
  const pts = loop.map(([i, j]) => rows[i][j]);
  let area = 0;
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    const q = pts[(k + 1) % pts.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  const sign = area >= 0 ? 1 : -1;
  const n = pts.length;
  const moves = pts.map((p, k) => {
    let a = (k - 1 + n) % n;
    while (a !== k && dist(pts[a], p) < 1e-6) a = (a - 1 + n) % n;
    let c = (k + 1) % n;
    while (c !== k && dist(pts[c], p) < 1e-6) c = (c + 1) % n;
    const tx = pts[c][0] - pts[a][0];
    const ty = pts[c][1] - pts[a][1];
    const len = Math.hypot(tx, ty) || 1;
    return [(sign * ty * m) / len, (-sign * tx * m) / len] as Pt;
  });
  loop.forEach(([i, j], k) => {
    rows[i][j] = [rows[i][j][0] + moves[k][0], rows[i][j][1] + moves[k][1]];
  });
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const even = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

/**
 * n + 1 parameters along one direction of a region, evenly spaced over
 * the body rather than over the flat drawing. Where a lamp wraps round a
 * corner, the drawing squeezes the corner into a sliver; spacing by the
 * laid length gives the corner its share of rows, so the decal follows the
 * curve instead of cutting across it.
 */
export function laidParams(proj: Projector, r: Region, n: number, along: boolean): number[] {
  if (n < 2) return even(n);
  const fine = 8 * n;
  const grid = along ? regionGrid(r, even(fine), [0.5]) : regionGrid(r, [0.5], even(fine));
  const pts = (along ? grid.map((row) => row[0]) : grid[0]).map(([a, b]) => proj.hit(r.view, a, b)?.p ?? null);
  const acc = [0];
  for (let i = 1; i <= fine; i++) {
    const p = pts[i];
    const q = pts[i - 1];
    acc.push(acc[i - 1] + (p && q ? Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) : 0));
  }
  const total = acc[fine];
  if (total < 1e-6) return even(n);
  const out = [0];
  let j = 0;
  for (let k = 1; k < n; k++) {
    const d = (total * k) / n;
    while (j < fine - 1 && acc[j + 1] < d) j++;
    out.push((j + (d - acc[j]) / (acc[j + 1] - acc[j] || 1)) / fine);
  }
  out.push(1);
  return out;
}

/**
 * The outline of a region as one closed loop in its view's plane, with
 * its points spaced evenly over the body. `grow` widens it on every side;
 * a region that meets the centerline stays on it, to join its mirror
 * image. `misses` counts outline points with no body under them, which
 * tests keep at zero.
 */
export function outlineLoop(proj: Projector, r: Region, nu: number, nv: number, grow = 0): { loop: Pt[]; misses: number } {
  const flat = regionGrid(r, laidParams(proj, r, nu, true), laidParams(proj, r, nv, false));
  const zi: 0 | 1 | null = r.view === 'top' ? 1 : r.view === 'side' ? null : 0;
  if (grow > 0) {
    growGrid(flat, grow);
    if (zi !== null) for (const row of flat) for (const p of row) p[zi] = Math.max(0, p[zi]);
  }
  const last = flat.length - 1;
  const top = flat[0].length - 1;
  const ring: Pt[] = [...flat.map((row) => row[0]), ...flat[last].slice(1), ...flat.slice(0, last).reverse().map((row) => row[top]), ...flat[0].slice(1, top).reverse()];
  const loop = ring.filter((p, i) => dist(p, ring[(i + ring.length - 1) % ring.length]) > 1e-6);
  // A point on the centerline sits on the half shell's very edge, so it is tested a hair inside.
  const inside = (p: Pt): Pt => (zi === null || p[zi] > 1e-4 ? p : zi === 0 ? [1e-4, p[1]] : [p[0], 1e-4]);
  const misses = loop.filter((p) => !proj.hit(r.view, ...inside(p))).length;
  return { loop, misses };
}

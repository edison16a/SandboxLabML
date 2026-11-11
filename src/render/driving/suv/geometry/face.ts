import type * as THREE from 'three';
import { bothSides, gridGeometry, merge, type Vec3 } from './grid';
import type { Detail } from './parts';
import type { Pt } from './section';
import { warp } from './warp';

/**
 * The normal of the bent end face at a point given before the bend. The
 * face is the plane x = const until the warp bends it, so its true normal
 * is the plane's normal carried through the warp. Using it instead of one
 * averaged from triangles keeps the face smooth whatever its grid looks like.
 */
export function faceNormal(end: 1 | -1, x: number, y: number, z: number): Vec3 {
  const e = 0.002;
  const a = warp([x, y + e, z]);
  const b = warp([x, y - e, z]);
  const c = warp([x, y, z + e]);
  const d = warp([x, y, z - e]);
  const uy = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const uz = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
  // Up crossed with across points forward (+x) on an unbent plane.
  const n: Vec3 = [uy[1] * uz[2] - uy[2] * uz[1], uy[2] * uz[0] - uy[0] * uz[2], uy[0] * uz[1] - uy[1] * uz[0]];
  const len = Math.hypot(n[0], n[1], n[2]) * end || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

/** Cumulative length along a polyline, as shares of the whole. */
function shares(pts: Pt[]): number[] {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[acc.length - 1] || 1;
  return acc.map((d) => d / total);
}

/**
 * A Coons patch: the grid that fills four boundaries, blending them so
 * every row and column runs smoothly from one side to the other. Bottom
 * and top run with u, left and right with v, and they meet at the corners.
 * Returns points[i][j] with i along u and j along v.
 */
export function coons(bottom: Pt[], top: Pt[], left: Pt[], right: Pt[]): Pt[][] {
  const sb = shares(bottom);
  const st = shares(top);
  const sl = shares(left);
  const sr = shares(right);
  const nu = bottom.length - 1;
  const nv = left.length - 1;
  const [p00, p10, p01, p11] = [bottom[0], bottom[nu], top[0], top[nu]];
  const out: Pt[][] = [];
  for (let i = 0; i <= nu; i++) {
    const col: Pt[] = [];
    for (let j = 0; j <= nv; j++) {
      const v = (sl[j] + sr[j]) / 2;
      const u = (sb[i] + st[i]) / 2;
      const p: Pt = [0, 0];
      for (const k of [0, 1]) {
        p[k] =
          (1 - v) * bottom[i][k] + v * top[i][k] + (1 - u) * left[j][k] + u * right[j][k] -
          ((1 - u) * (1 - v) * p00[k] + u * (1 - v) * p10[k] + (1 - u) * v * p01[k] + u * v * p11[k]);
      }
      col.push(i === 0 ? left[j] : i === nu ? right[j] : j === 0 ? bottom[i] : j === nv ? top[i] : p);
    }
    out.push(col);
  }
  return out;
}

/** Heights from `a` to `b` at z = 0, spaced like the heights of `like`, so rows stay level across a patch. */
function spacedLike(like: Pt[], a: number, b: number): Pt[] {
  const y0 = like[0][1];
  const span = like[like.length - 1][1] - y0 || 1;
  return like.map(([, y]) => [0, a + ((y - y0) / span) * (b - a)]);
}

/**
 * A hole in an end face: between two heights and out to `half(y)` either
 * side of the centerline. The face gets rows at exactly those heights, so
 * the hole's edge is a clean line in its grid. The nose leaves one for
 * the central intake, the tail one for the plate; their walls and the
 * mesh or plate behind fill it from behind.
 */
export interface FaceCut {
  y0: number;
  y1: number;
  half: (y: number) => number;
}

/** The outline with a point added at each height in `ys` below index `upto`, unless one is there already. */
function withRows(pts: Pt[], upto: number, ys: number[]): Pt[] {
  const out = [...pts];
  for (const y of ys) {
    const i = out.findIndex((p, k) => k < upto && p[1] <= y + 1e-6 && out[k + 1][1] >= y - 1e-6);
    if (i < 0 || Math.abs(out[i][1] - y) < 1e-5 || Math.abs(out[i + 1][1] - y) < 1e-5) continue;
    const [a, b] = [out[i], out[i + 1]];
    const t = (y - a[1]) / (b[1] - a[1]);
    out.splice(i + 1, 0, [a[0] + (b[0] - a[0]) * t, y]);
    upto++;
  }
  return out;
}

/**
 * The face closing the nose (+1) or the tail (-1) at x, filling the body's
 * outline there. The outline's points are the side panels' last row, so
 * the face shares their vertices and no crack opens at the corner. The
 * face is two grids: below, rows at the outline's own heights, level low
 * down and dipping toward the top edge's lowest point higher up; above,
 * a patch from that row to the hood or deck edge. Normals come from the
 * bend itself, so the face shades smooth whatever its grid looks like.
 * A hole's rows, and any asked for in `rowsAt` to carry a tight fold,
 * are added on the outline's own segments.
 */
export function endFace(end: 1 | -1, x: number, outline: Pt[], detail: Detail, cut?: FaceCut, rowsAt: number[] = []): THREE.BufferGeometry {
  const [b0, b1, b2, b3] = detail.bands;
  const half = withRows(outline, b0 + b1 + b2, cut ? [cut.y0, cut.y1, ...rowsAt] : rowsAt);
  const sh = b0 + b1 + b2 + half.length - outline.length;
  const top = half.slice(sh + b3).reverse();
  const ys = half[0][1];
  const ysh = half[sh][1];
  const yt = top[0][1];
  // The top row: level at the shoulder, dipping at the middle only if the top edge is low there.
  const ym = Math.min(ysh, ys + 0.85 * (yt - ys));
  // Rows stay level up to the hole's top, then ease toward that dip.
  const level = cut ? cut.y1 + 0.005 : ys;
  const cols = top.length - 1;
  const inner = cut ? Math.round(cols * 0.55) : 0;
  const rows: Pt[][] = half.slice(0, sh + 1).map(([zr, yr]) => {
    const yl = yr <= level ? yr : level + ((yr - level) * (ym - level)) / Math.max(ysh - level, 1e-6);
    const g = cut ? Math.min(cut.half(yr), zr - 0.04) : 0;
    return Array.from({ length: cols + 1 }, (_, i) => {
      const z = cut ? (i <= inner ? (g * i) / inner : g + ((zr - g) * (i - inner)) / (cols - inner)) : (zr * i) / cols;
      return [z, yl + (yr - yl) * (z / zr) ** 2] as Pt;
    });
  });
  // The upper patch crosses the fold under the hood's edge, so it gets extra rows: each step of the
  // outline is split, which keeps every body vertex on the edge and adds points only along its segments.
  const upRight = split(half.slice(sh, sh + b3 + 1), detail.fine ? 3 : detail.brakes ? 2 : 1);
  const upper = coons(rows[sh], top, spacedLike(upRight, ym, yt), upRight);
  const from = cut ? half.findIndex(([, y]) => Math.abs(y - cut.y0) < 1e-5) : -1;
  const to = cut ? half.findIndex(([, y]) => Math.abs(y - cut.y1) < 1e-5) : -1;
  const skip = (i: number, j: number) => !!cut && i >= from && i < to && j < inner;
  // Rows up and columns across face +x; flipped for the tail.
  const lower = grid(end, x, end > 0 ? rows : transpose(rows), end > 0 ? skip : (i, j) => skip(j, i));
  return bothSides(merge([lower, grid(end, x, end > 0 ? transpose(upper) : upper)]));
}

const transpose = (m: Pt[][]): Pt[][] => m[0].map((_, j) => m.map((r) => r[j]));

/** A polyline with each segment cut into `n` equal steps. */
function split(pts: Pt[], n: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** A face grid laid through the bend, with the bend's own normals and flat UVs in meters; `skip` drops cells for a hole. */
function grid(end: 1 | -1, x: number, rows: Pt[][], skip?: (i: number, j: number) => boolean): THREE.BufferGeometry {
  const g = gridGeometry(rows.map((row) => row.map(([z, y]) => warp([x, y, z]))));
  const normal = g.attributes.normal;
  const uv = g.attributes.uv;
  rows.flat().forEach(([z, y], k) => {
    normal.setXYZ(k, ...faceNormal(end, x, y, z));
    uv.setXY(k, z, y);
  });
  if (skip && g.index) {
    const nc = rows[0].length - 1;
    const src = g.index.array;
    const keep: number[] = [];
    for (let t = 0; t < src.length; t += 6) {
      const cell = t / 6;
      if (!skip(Math.floor(cell / nc), cell % nc)) for (let k = 0; k < 6; k++) keep.push(src[t + k]);
    }
    g.setIndex(keep);
  }
  return g;
}

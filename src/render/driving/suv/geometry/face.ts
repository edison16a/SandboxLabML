import * as THREE from 'three';
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

/** Heights from `a` to `b`, spaced like the heights of `like`, so rows stay level across a patch. */
function spacedLike(like: Pt[], a: number, b: number): Pt[] {
  const y0 = like[0][1];
  const span = like[like.length - 1][1] - y0 || 1;
  return like.map(([, y]) => [0, a + ((y - y0) / span) * (b - a)]);
}

/**
 * The face closing the nose (+1) or the tail (-1) at x, filling the body's
 * outline there. The outline's points are the side panels' last row, so
 * the face shares their vertices and no crack opens at the corner. The
 * face is two regular grids: below the shoulder a near rectangle, above it
 * the roll over the top and the hood or deck edge. Rows stay level and
 * columns upright, so no long thin triangles meet in the middle.
 */
export function endFace(end: 1 | -1, x: number, half: Pt[], detail: Detail): THREE.BufferGeometry {
  const [b0, b1, b2, b3] = detail.bands;
  const sh = b0 + b1 + b2;
  const c = sh + Math.ceil(b3 / 2);
  const top = half.slice(c).reverse();
  const [zs, ys] = half[0];
  const [zsh, ysh] = half[sh];
  const zc = half[c][0];
  const yt = top[0][1];
  // The row between the two grids: level at the shoulder, dipping at the middle only if the top edge is low there.
  const ym = Math.min(ysh, ys + 0.85 * (yt - ys));
  const mid: Pt[] = top.map(([z]) => {
    const t = z / zc;
    return [t * zsh, ym + (ysh - ym) * t * t];
  });
  const bottom: Pt[] = top.map(([z]) => [(z / zc) * zs, ys]);
  const lowRight = half.slice(0, sh + 1);
  const upRight = half.slice(sh, c + 1);
  const lower = coons(bottom, mid, spacedLike(lowRight, ys, ym), lowRight);
  const upper = coons(mid, top, spacedLike(upRight, ym, yt), upRight);
  const parts = [lower, upper].map((patch) => {
    // Rows up and columns across face +x; flipped for the tail.
    const cols = patch[0].map((_, j) => patch.map((col) => col[j]));
    const rows = end > 0 ? cols : patch;
    const g = gridGeometry(rows.map((row) => row.map(([z, y]) => warp([x, y, z]))));
    const normal = g.attributes.normal;
    const flat = rows.flat();
    flat.forEach(([z, y], k) => normal.setXYZ(k, ...faceNormal(end, x, y, z)));
    // Flat UVs in meters across the face, so paint flake keeps its scale.
    const uv = g.attributes.uv;
    flat.forEach(([z, y], k) => uv.setXY(k, z, y));
    return g;
  });
  return bothSides(merge(parts));
}

import type * as THREE from 'three';
import { gridGeometry, type Vec3 } from '../../suv/geometry/grid';
import type { CarShape } from '../shape/types';
import type { TrafficDetail } from './detail';
import { archRadius, axles, keysAt, planShare, shoulderOut, warpX } from './frame';
import { trueNormals, type RowAt } from './normals';
import { deg, resample, span, through, type Pt } from './section';
import { lowerStations, upperStations } from './stations';

/** The wheel opening's top edge at x, or -1 away from the wheels. */
export function archFloor(s: CarShape, x: number): number {
  const r = archRadius(s);
  for (const axle of axles(s)) {
    const d = Math.abs(x - axle);
    if (d <= r + 1e-9) return s.wheelRadius + Math.sqrt(Math.max(0, r * r - d * d));
  }
  return -1;
}

/** Points above `floor` along a polyline, resampled to `steps`; all at the crossing if none are above. */
function above(pts: Pt[], floor: number, steps: number): Pt[] {
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (y0 <= floor && y1 > floor) {
      const t = (floor - y0) / (y1 - y0);
      return resample([[z0 + (z1 - z0) * t, floor], ...pts.slice(i + 1)], steps);
    }
  }
  const last = pts[pts.length - 1];
  return Array.from({ length: steps + 1 }, () => [last[0], last[1]] as Pt);
}

/**
 * The three panels of the section at x at full width, before the plan
 * narrows it: the black lower trim, the lower side up to the shoulder
 * crease, and everything from the crease over to the centerline. Inside a
 * wheel opening the lower panels stop at the opening's edge.
 */
export function sectionPanels(s: CarShape, x: number, d: TrafficDetail, floor = archFloor(s, x)): Pt[][] {
  const k = keysAt(s, x);
  const lowKeys = [{ ...k[1], a: deg(-6) }, k[2], k[3]];
  const trim = span(k[0], k[1], d.p0);
  let lower = through(lowKeys, d.p1);
  const upper = through([{ ...k[3], a: shoulderOut(k) }, k[4], k[5], k[6], k[7]], d.p2);
  if (floor < 0) return [trim, lower, upper];
  if (floor < k[1].y) return [above(span(k[0], k[1], 16), floor, d.p0), lower, upper];
  lower = above(through(lowKeys, [16, 16]), floor, d.p1[0] + d.p1[1]);
  return [trim.map(() => [lower[0][0], lower[0][1]] as Pt), lower, upper];
}

/** The same detail with every section span's steps times k, so its points include the original ones. */
function finer(d: TrafficDetail, k: number): TrafficDetail {
  if (k === 1) return d;
  return { ...d, p0: d.p0 * k, p1: [d.p1[0] * k, d.p1[1] * k], p2: [d.p2[0] * k, d.p2[1] * k, d.p2[2] * k, d.p2[3] * k] };
}

/** The body's right half (z of 0 and up): one grid per panel, plus the underbody, ready to mirror. */
export interface Shell {
  panels: THREE.BufferGeometry[];
  underbody: THREE.BufferGeometry;
  stations: { lower: number[]; upper: number[] };
}

/**
 * Lofts the right half of the body through its stations. The plan narrows
 * each section toward the tips, so the ends close by themselves with no
 * caps, and the ends' lean is applied last. Only the lower panels need
 * rows across the wheel openings; the panel above the shoulder skips
 * them. Normals are smooth inside each panel; on the centerline they lie
 * in its plane, so the two mirrored halves meet with no seam.
 */
export function buildShell(s: CarShape, d: TrafficDetail): Shell {
  const lower = lowerStations(s, d);
  const upper = upperStations(s, d);
  const rows: Vec3[][][] = [[], [], []];
  const at: RowAt[][] = [[], [], []];
  const place = (x: number, pts: Pt[]) => {
    const share = planShare(s, x);
    return pts.map(([z, y]) => [warpX(s, x, y), y, z * share] as Vec3);
  };
  const add = (p: number, x: number, floor: number) => {
    rows[p].push(place(x, sectionPanels(s, x, d, floor)[p]));
    at[p].push({ x, floor });
  };
  // Inside a wheel opening the black trim shrinks to a point on the opening's edge. Those rows
  // draw nothing, so only the first and last of each run are kept, to close the opening's sides.
  const buried = lower.map((x) => archFloor(s, x) >= keysAt(s, x)[1].y);
  lower.forEach((x, i) => {
    const floor = archFloor(s, x);
    if (!buried[i] || !buried[i - 1] || !buried[i + 1]) add(0, x, floor);
    add(1, x, floor);
  });
  for (const x of upper) add(2, x, -1);
  // The underbody closes the bottom along the sill's own edge. Through the ends, where the sill
  // curves up, it takes every station so it meets the skin exactly; the flat middle needs few.
  const under = upper.filter((x, i) => i % 3 === 0 || i === upper.length - 1 || planShare(s, x) < 1).map((x) => {
    const k0 = keysAt(s, x)[0];
    return place(x, [[0, k0.y], [k0.z, k0.y]]);
  });
  const panels = rows.map((r, p) => {
    const g = gridGeometry(r);
    trueNormals(g, at[p], (x, floor, k) => place(x, sectionPanels(s, x, finer(d, k), floor)[p]), s.length / 2);
    return centerNormals(g);
  });
  return { panels, underbody: centerNormals(gridGeometry(under)), stations: { lower, upper } };
}

/** Normals of points on the centerline lie in its plane, so mirrored halves shade as one. */
function centerNormals(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getZ(i)) > 1e-6) continue;
    const nx = n.getX(i);
    const ny = n.getY(i);
    const len = Math.hypot(nx, ny) || 1;
    n.setXYZ(i, nx / len, ny / len, 0);
  }
  return g;
}

/** The uncut outline from the sill to the shoulder crease at x, at full width, finely sampled. */
export function lowerOutline(s: CarShape, x: number): Pt[] {
  const k = keysAt(s, x);
  return [...span(k[0], k[1], 12), ...through([{ ...k[1], a: deg(-6) }, k[2], k[3]], [16, 16]).slice(1)];
}

/** How far out the body side is at (x, y) below the shoulder, m. */
export function sideZ(s: CarShape, x: number, y: number): number {
  const pts = lowerOutline(s, x);
  const share = planShare(s, x);
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (y0 <= y && y1 >= y) return (z0 + ((z1 - z0) * (y - y0)) / (y1 - y0 || 1)) * share;
  }
  return pts[y < pts[0][1] ? 0 : pts.length - 1][0] * share;
}

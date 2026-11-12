import { curlStation, NOSE, ROUND, TAIL } from './ends';
import type { Vec3 } from './grid';
import { sectionAt } from './profile';
import { span, type Pt } from './section';
import { warp } from './warp';

/** The end face's outline pieces, cached per end: its side edge (sill to shoulder) and its top edge (shoulder over to the centerline). */
const cache = new Map<number, { edge: Pt[]; top: Pt[] }>();

function capOutline(end: 1 | -1): { edge: Pt[]; top: Pt[] } {
  let c = cache.get(end);
  if (!c) {
    const k = sectionAt(end > 0 ? NOSE : TAIL).keys;
    const run = (from: number, to: number, steps: number) => Array.from({ length: to - from }, (_, i) => span(k[from + i], k[from + i + 1], steps).slice(i === 0 ? 0 : 1)).flat();
    c = { edge: run(0, 3, 16), top: run(3, 7, 16) };
    cache.set(end, c);
  }
  return c;
}

/**
 * Height of the top edge of the nose (+1) or tail (-1) face at z: where
 * the hood or the deck rolls into it. Lamps that hug the top follow it.
 */
export function faceTop(end: 1 | -1, z: number): number {
  const top = capOutline(end).top;
  const a = Math.abs(z);
  for (let i = 0; i < top.length - 1; i++) {
    const [z0, y0] = top[i];
    const [z1, y1] = top[i + 1];
    if (a <= z0 && a >= z1) return y0 + ((y1 - y0) * (a - z0)) / (z1 - z0 || 1);
  }
  return top[0][1];
}

/**
 * Half width of the nose (+1) or tail (-1) face at height y, up to the
 * shoulder: where it curls round into the side.
 */
export function faceEdge(end: 1 | -1, y: number): number {
  return zAtHeight(capOutline(end).edge, y);
}

/** z of a rising outline at height y, held at its ends outside them. */
function zAtHeight(pts: Pt[], y: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (y >= y0 && y <= y1) return z0 + ((z1 - z0) * (y - y0)) / (y1 - y0 || 1);
  }
  return y < pts[0][1] ? pts[0][0] : pts[pts.length - 1][0];
}

/** Radius of an end's curl in plan view, m. */
const curlR = (end: 1 | -1) => (end > 0 ? ROUND.nose.plan : ROUND.tail.plan);

/**
 * A point on an end's curled corner before the bend: `a` radians round
 * from the face (0) toward the side, at height y. It sits on the section
 * the body grid uses at that station, so lamps wrapped round the corner
 * lie on the paint.
 */
function cornerPoint(end: 1 | -1, a: number, y: number): Vec3 {
  const x = curlStation(end, Math.PI / 2 - a);
  const k = sectionAt(x).keys;
  const side = Array.from({ length: 4 }, (_, i) => span(k[i], k[i + 1], 16).slice(i === 0 ? 0 : 1)).flat();
  return [x, y, zAtHeight(side, y)];
}

/**
 * A point on the nose (+1) or tail (-1) face at (s, y), lifted off it by
 * `lift` m. Across the flat face s is simply z. Past the face's edge s
 * carries on round the curled corner by arc length, so a lamp or an
 * intake drawn wider than the face wraps onto the corner instead of
 * hanging in the air.
 */
export function onCap(end: 1 | -1, s: number, y: number, lift = 0.004): Vec3 {
  const sign = s < 0 ? -1 : 1;
  const edge = faceEdge(end, y);
  const x0 = end > 0 ? NOSE : TAIL;
  if (Math.abs(s) <= edge) return warp([x0 + end * lift, y, s]);
  const r = curlR(end);
  const a = Math.min(Math.PI / 2, (Math.abs(s) - edge) / r);
  const p = cornerPoint(end, a, y);
  // The surface normal from two nearby points, turned to face out of the corner.
  const e = 0.004;
  const pa = cornerPoint(end, Math.min(Math.PI / 2, a + e / r), y);
  const pb = cornerPoint(end, Math.max(0, a - e / r), y);
  const py = cornerPoint(end, a, y + e);
  const qy = cornerPoint(end, a, y - e);
  const u = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]];
  const v = [py[0] - qy[0], py[1] - qy[1], py[2] - qy[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  n = n.map((c) => c / len);
  if (n[0] * end * Math.cos(a) + n[2] * Math.sin(a) < 0) n = n.map((c) => -c);
  return warp([p[0] + n[0] * lift, p[1] + n[1] * lift, sign * (p[2] + n[2] * lift)]);
}

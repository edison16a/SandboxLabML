import type { City } from '../city/types';
import type { Projection } from '../geometry/path';
import type { Crowd } from './crowd';

/** Where crossings meet one sidewalk loop: arc length, crossing id and which end. */
export interface RingCrossings {
  s: Float64Array;
  cw: Int32Array;
  end: Uint8Array;
}

export function ringCrossings(city: City): RingCrossings[] {
  return city.rings.map((_, r) => {
    const s: number[] = [];
    const cw: number[] = [];
    const end: number[] = [];
    for (const k of city.crosswalks) {
      if (k.ringA === r) {
        s.push(k.sA);
        cw.push(k.id);
        end.push(0);
      }
      if (k.ringB === r) {
        s.push(k.sB);
        cw.push(k.id);
        end.push(1);
      }
    }
    return { s: Float64Array.from(s), cw: Int32Array.from(cw), end: Uint8Array.from(end) };
  });
}

/** The crossing end passed while walking `ds` meters (signed) from s0 on a loop of length `len`, or -1. */
export function reachedCrossing(pts: RingCrossings, s0: number, ds: number, len: number): number {
  const reach = Math.abs(ds);
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < pts.s.length; k++) {
    const raw = ds >= 0 ? pts.s[k] - s0 : s0 - pts.s[k];
    const d = ((raw % len) + len) % len;
    if (d < reach && d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/** Distance from v to the nearest of the street lines, m. */
function nearestLine(lines: Float64Array, v: number): [number, number] {
  let best = 0;
  for (let i = 1; i < lines.length; i++) if (Math.abs(lines[i] - v) < Math.abs(lines[best] - v)) best = i;
  return [lines[best], Math.abs(lines[best] - v)];
}

/** People only cross mid block this far from any intersection, m. */
const MID_BLOCK = 22;

/**
 * Sets up a mid block crossing for person i if they are on a straight
 * stretch of sidewalk well away from any corner: the target is the point
 * straight across the street, on whichever loop runs along the far side.
 * False when this is not a place to cross.
 */
export function jaywalkTarget(city: City, c: Crowd, i: number, proj: Projection): boolean {
  const x = c.x[i];
  const y = c.y[i];
  const heading = c.heading[i];
  const alongX = Math.abs(Math.cos(heading)) > 0.995;
  const alongY = Math.abs(Math.sin(heading)) > 0.995;
  if (!alongX && !alongY) return false;
  // Walking along x means walking beside a horizontal street: mirror across it.
  const [line, gap] = alongX ? nearestLine(city.ys, y) : nearestLine(city.xs, x);
  const [, fromCorner] = alongX ? nearestLine(city.xs, x) : nearestLine(city.ys, y);
  if (gap > 7 || fromCorner < MID_BLOCK) return false;
  const tx = alongX ? x : 2 * line - x;
  const ty = alongX ? 2 * line - y : y;
  let best = -1;
  let bestD = 1.5;
  let bestS = 0;
  city.rings.forEach((ring, r) => {
    ring.project(tx, ty, 0, ring.n, proj);
    if (proj.distance < bestD) {
      bestD = proj.distance;
      best = r;
      bestS = proj.s;
    }
  });
  if (best < 0) return false;
  c.tx[i] = tx;
  c.ty[i] = ty;
  c.toRing[i] = best;
  c.toS[i] = bestS;
  return true;
}

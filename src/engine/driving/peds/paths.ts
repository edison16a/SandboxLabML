import type { City } from '../city/types';
import type { Projection } from '../geometry/path';
import type { WorldState } from '../world/state';
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
/** A car coming toward a mid block crossing this close, m, or this many seconds away, means wait. */
const LOOK_BOTH_WAYS = 32;
const LOOK_SECONDS = 4.5;
/** Any car this close to the crossing point, m, means wait too. */
const NEAR_CAR = 28;

/**
 * True when no car is near the line across the street at (mx, my), and
 * none on the street is coming toward it, the street running along
 * (ux, uy). Reads last tick's traffic.
 */
function streetClear(world: WorldState, mx: number, my: number, ux: number, uy: number): boolean {
  for (let i = 0; i < world.carCount; i++) {
    const dx = world.carX[i] - mx;
    const dy = world.carY[i] - my;
    const across = Math.abs(-dx * uy + dy * ux);
    const along = dx * ux + dy * uy;
    const toward = -(Math.cos(world.carHeading[i]) * ux + Math.sin(world.carHeading[i]) * uy) * Math.sign(along);
    // Any car close by, wherever it points: one turning in from the junction straightens up in a moment.
    if (dx * dx + dy * dy < NEAR_CAR * NEAR_CAR) return false;
    // Coming this way along the street: wait unless it is further off than a few seconds' drive.
    if (across < 4.5 && toward > 0.3 && Math.abs(along) < Math.max(LOOK_BOTH_WAYS, world.carSpeed[i] * LOOK_SECONDS)) return false;
  }
  return true;
}

/**
 * Sets up a mid block crossing for person i if they are on a straight
 * stretch of sidewalk well away from any corner: the target is the point
 * straight across the street, on whichever loop runs along the far side.
 * False when this is not a place to cross, or a car is coming.
 */
export function jaywalkTarget(city: City, c: Crowd, i: number, proj: Projection, world: WorldState): boolean {
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
  if (!streetClear(world, (x + tx) / 2, (y + ty) / 2, alongX ? 1 : 0, alongX ? 0 : 1)) return false;
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

import { wrapAngle } from '../../core/math';
import { castStatic, rayCircle } from '../city/surface';
import type { City } from '../city/types';
import { MAX_PEDS, MAX_TRAFFIC, type WorldState } from '../world/state';
import type { Nearby } from './nearby';

/** What a beam hit. */
export const HIT_NONE = 0;
export const HIT_STATIC = 1;
export const HIT_CAR = 2;
export const HIT_PED = 3;
/** A person is a 0.3 m circle to the sensors and the collision check. */
export const PED_RADIUS = 0.3;

/** Distance along a unit ray to an oriented box (a car), or Infinity. */
function rayCar(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, heading: number, hl: number, hw: number): number {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const rx = ox - cx;
  const ry = oy - cy;
  const lx = rx * c + ry * s;
  const ly = -rx * s + ry * c;
  const ux = dx * c + dy * s;
  const uy = -dx * s + dy * c;
  const ix = ux !== 0 ? 1 / ux : 1e12;
  const iy = uy !== 0 ? 1 / uy : 1e12;
  const ta = (-hl - lx) * ix;
  const tb = (hl - lx) * ix;
  const ua = (-hw - ly) * iy;
  const ub = (hw - ly) * iy;
  const enter = Math.max(Math.min(ta, tb), Math.min(ua, ub));
  const exit = Math.min(Math.max(ta, tb), Math.max(ua, ub));
  if (exit < 0 || enter > exit) return Infinity;
  return enter > 0 ? enter : 0;
}

/**
 * A ring of lidar beams. Each tick it keeps the nearby cars and people
 * within reach, then casts every beam against the curbs (walking the street
 * grid) and those few objects. The renderer runs this same code on
 * the world it draws, so the beams on screen are the brain's beams.
 */
export class Lidar {
  readonly angles: Float64Array;
  private readonly ca: Float64Array;
  private readonly sa: Float64Array;
  private readonly cars = new Int32Array(MAX_TRAFFIC);
  private readonly peds = new Int32Array(MAX_PEDS);
  /** Per object in reach: bearing from the heading, angular half width, and distance to its nearest point. */
  private readonly carBear = new Float64Array(MAX_TRAFFIC);
  private readonly carSpan = new Float64Array(MAX_TRAFFIC);
  private readonly carNear = new Float64Array(MAX_TRAFFIC);
  private readonly pedBear = new Float64Array(MAX_PEDS);
  private readonly pedSpan = new Float64Array(MAX_PEDS);
  private readonly pedNear = new Float64Array(MAX_PEDS);

  constructor(angles: ArrayLike<number>) {
    this.angles = Float64Array.from(angles);
    this.ca = this.angles.map(Math.cos);
    this.sa = this.angles.map(Math.sin);
  }

  /**
   * Casts every beam from (x, y) for a car facing `heading`, against the
   * curbs and the cars and people in `near` (gathered around the same
   * point). Writes the distance in meters and what was hit, and when `hit`
   * is given, the world index of the car or person each beam struck (-1
   * otherwise).
   */
  cast(city: City, world: WorldState, near: Nearby, x: number, y: number, heading: number, range: number, dist: Float64Array, kind: Uint8Array, hit: Int32Array | null = null): void {
    const reach2 = (range + 3) * (range + 3);
    const ch = Math.cos(heading);
    const sh = Math.sin(heading);
    // Keep what is in reach, with its bearing and how wide it looks, so each beam only tests what lies along it.
    let nc = 0;
    for (let k = 0; k < near.carCount; k++) {
      const i = near.cars[k];
      const dx = world.carX[i] - x;
      const dy = world.carY[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach2) continue;
      const d = Math.sqrt(d2);
      const r = Math.hypot(world.carLength[i], world.carWidth[i]) / 2;
      this.carBear[nc] = Math.atan2(-dx * sh + dy * ch, dx * ch + dy * sh);
      this.carSpan[nc] = d > r ? Math.asin(r / d) + 1e-3 : Math.PI;
      this.carNear[nc] = d - r;
      this.cars[nc++] = i;
    }
    let np = 0;
    for (let k = 0; k < near.pedCount; k++) {
      const i = near.peds[k];
      const dx = world.pedX[i] - x;
      const dy = world.pedY[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach2) continue;
      const d = Math.sqrt(d2);
      this.pedBear[np] = Math.atan2(-dx * sh + dy * ch, dx * ch + dy * sh);
      this.pedSpan[np] = d > PED_RADIUS ? Math.asin(PED_RADIUS / d) + 1e-3 : Math.PI;
      this.pedNear[np] = d - PED_RADIUS;
      this.peds[np++] = i;
    }
    for (let r = 0; r < this.angles.length; r++) {
      const a = this.angles[r];
      const dx = ch * this.ca[r] - sh * this.sa[r];
      const dy = sh * this.ca[r] + ch * this.sa[r];
      let best = castStatic(city, x, y, dx, dy, range);
      let what = best < range ? HIT_STATIC : HIT_NONE;
      let who = -1;
      for (let k = 0; k < nc; k++) {
        if (this.carNear[k] >= best || Math.abs(wrapAngle(a - this.carBear[k])) > this.carSpan[k]) continue;
        const i = this.cars[k];
        const t = rayCar(x, y, dx, dy, world.carX[i], world.carY[i], world.carHeading[i], world.carLength[i] / 2, world.carWidth[i] / 2);
        if (t < best) {
          best = t;
          what = HIT_CAR;
          who = i;
        }
      }
      for (let k = 0; k < np; k++) {
        if (this.pedNear[k] >= best || Math.abs(wrapAngle(a - this.pedBear[k])) > this.pedSpan[k]) continue;
        const i = this.peds[k];
        const t = rayCircle(x, y, dx, dy, world.pedX[i], world.pedY[i], PED_RADIUS);
        if (t < best) {
          best = t;
          what = HIT_PED;
          who = i;
        }
      }
      dist[r] = best;
      kind[r] = what;
      if (hit) hit[r] = who;
    }
  }
}

import type { Course } from '../course/build';
import { sampleFlow } from '../course/fieldSample';
import { moverSweep } from '../course/movers';

/** Room the navigator keeps from a mover, m, on top of its own radius. */
export const MOVER_CLEARANCE = 0.1;
/** How far along the path hint the navigator looks for a mover's floor, m. */
const LOOK = 4.5;
/** Step of that look, m. */
const LOOK_STEP = 0.25;

/**
 * The floor each mover can ever reach, grown by an agent's radius and the
 * clearance, packed as x, z, hx, hz. Outside it no mover can touch the
 * agent, whatever the time, so the navigator only plans where it begins.
 * Worked out once per course and radius.
 */
const sweepCache = new WeakMap<Course, { radius: number; rects: Float64Array }>();

export function moverZones(course: Course, radius: number): Float64Array {
  const hit = sweepCache.get(course);
  if (hit && hit.radius === radius) return hit.rects;
  const grow = radius + MOVER_CLEARANCE;
  const rects = new Float64Array(course.movers.length * 4);
  course.movers.forEach((m, k) => {
    const s = moverSweep(m);
    rects.set([s.x, s.z, s.hx + grow, s.hz + grow], k * 4);
  });
  sweepCache.set(course, { radius, rects });
  return rects;
}

/** Which mover zone (x, z) stands in, at least `depth` m inside its edge, or -1. */
export function zoneAt(zones: Float64Array, x: number, z: number, depth = 0): number {
  for (let k = 0; k * 4 < zones.length; k++) {
    const o = k * 4;
    if (Math.abs(x - zones[o]) < zones[o + 2] - depth && Math.abs(z - zones[o + 1]) < zones[o + 3] - depth) return k;
  }
  return -1;
}

/** A mover zone on the way: where the path first enters it, the path's direction there and how far off it is. */
export interface MoverHazard {
  mover: number;
  /** The agent already stands in the zone. */
  inside: boolean;
  /** Where the path hint enters the zone, and its unit direction there. */
  ex: number;
  ez: number;
  dx: number;
  dz: number;
  /** Path distance from the agent to the entry, m. */
  distance: number;
}

const flow = { x: 0, z: 0 };

/**
 * Walks the path hint from (x, z) for a few meters and reports the first
 * mover zone it enters, or false when the way ahead is clear of movers.
 * Movers further on are left for later: only what is close decides.
 */
export function findHazard(course: Course, zones: Float64Array, x: number, z: number, out: MoverHazard): boolean {
  let px = x;
  let pz = z;
  for (let s = 0; s <= LOOK + 1e-9; s += LOOK_STEP) {
    const k = zoneAt(zones, px, pz);
    sampleFlow(course.field, px, pz, flow);
    if (k >= 0) {
      out.mover = k;
      out.inside = s === 0;
      out.ex = px;
      out.ez = pz;
      out.dx = flow.x;
      out.dz = flow.z;
      out.distance = s;
      return true;
    }
    px += flow.x * LOOK_STEP;
    pz += flow.z * LOOK_STEP;
  }
  return false;
}

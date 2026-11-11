import { wrapAngle } from '../../core/math';
import type { NavAgent } from '../agent';
import type { Course } from '../course/build';
import { deepestOverlap } from '../kinematics/collide';
import type { MoverHazard } from './hazard';

/** Gap between lanes across a mover zone, m. */
const LANE_STEP = 0.3;
/** Lanes also run this far past each end of the zone, m: round a mover that leaves free floor beside it, no wait is needed. */
const BESIDE = 1.6;


/**
 * The lanes across one mover zone: straight lines square to the way the
 * mover slides, LANE_STEP apart, fixed to the zone so a lane picked on
 * one tick is the same lane on the next. The outermost run beside the
 * zone, where no mover reaches. Lane j crosses at `first + j *
 * step` m along the slide axis u from the zone's middle, entering by the
 * near face and running `depth` m along the crossing axis c.
 */
export interface ZoneLanes {
  count: number;
  first: number;
  step: number;
  ux: number;
  uz: number;
  cx: number;
  cz: number;
  /** Where along u the path itself enters the zone, m from its middle. */
  cu: number;
  /** Half the zone's depth along c, and the full walk across it, m. */
  hc: number;
  depth: number;
}

/**
 * The crossing direction of mover k: square to the way it slides, pointing
 * along (dx, dz). A mover that does not slide is crossed along (dx, dz).
 */
export function crossingAxis(course: Course, k: number, dx: number, dz: number, out: { x: number; z: number }): void {
  const m = course.movers[k];
  const ux = m.bx - m.ax;
  const uz = m.bz - m.az;
  const len = Math.hypot(ux, uz);
  if (len < 1e-6) {
    out.x = dx;
    out.z = dz;
    return;
  }
  const s = -uz * dx + ux * dz >= 0 ? 1 : -1;
  out.x = (-uz / len) * s;
  out.z = (ux / len) * s;
}

const c = { x: 0, z: 0 };

/** Fills the lanes of zone k for a path that enters it as `h` says. */
export function lanesOf(course: Course, zones: Float64Array, k: number, h: MoverHazard, out: ZoneLanes): ZoneLanes {
  crossingAxis(course, k, h.dx, h.dz, c);
  out.cx = c.x;
  out.cz = c.z;
  // The slide axis, a quarter turn from c.
  out.ux = -c.z;
  out.uz = c.x;
  const o = k * 4;
  const hu = Math.abs(out.ux) * zones[o + 2] + Math.abs(out.uz) * zones[o + 3];
  out.hc = Math.abs(out.cx) * zones[o + 2] + Math.abs(out.cz) * zones[o + 3];
  out.depth = out.hc * 2 + 0.2;
  const span = Math.max(0, (hu + BESIDE) * 2 - LANE_STEP);
  out.count = Math.floor(span / LANE_STEP) + 1;
  out.step = LANE_STEP;
  out.first = -((out.count - 1) * LANE_STEP) / 2;
  out.cu = (h.ex - zones[o]) * out.ux + (h.ez - zones[o + 1]) * out.uz;
  return out;
}

/** Where lane j enters zone k, on its near face. */
export function laneEntry(l: ZoneLanes, zones: Float64Array, k: number, j: number, out: { x: number; z: number }): void {
  const w = l.first + j * l.step;
  out.x = zones[k * 4] + l.ux * w - l.cx * l.hc;
  out.z = zones[k * 4 + 1] + l.uz * w - l.cz * l.hc;
}

/** Whether an agent can stand at (x, z): off every solid with a hair to spare, and well off spikes. */
export function standsClear(course: Course, x: number, z: number, r: number): boolean {
  return deepestOverlap(x, z, r + 0.05, course.solidData, course.solids.length) === 0 && deepestOverlap(x, z, r + 0.1, course.spikeData, course.spikes.length) === 0;
}

/** Whether a straight walk from (x0, z0) to (x1, z1) keeps clear of solids and spikes, checked every 0.2 m. */
export function lineClear(course: Course, x0: number, z0: number, x1: number, z1: number, r: number): boolean {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.ceil(len / 0.2);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!standsClear(course, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, r - 0.03)) return false;
  }
  return true;
}

/** Seconds the agent needs to turn to (hx, hz) before it really gets going. */
export function turnDelay(a: NavAgent, hx: number, hz: number, turnRate: number): number {
  const off = Math.abs(wrapAngle(Math.atan2(-hz, hx) - a.yaw));
  return Math.max(0, off - 0.45) / turnRate;
}

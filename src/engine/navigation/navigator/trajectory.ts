import type { Course } from '../course/build';
import { moverPosition, type Point } from '../course/movers';
import { deepestOverlap } from '../kinematics/collide';
import { MOVER_CLEARANCE, zoneAt } from './hazard';

/** Samples along a plan, m apart, and the most a plan holds. */
const STEP = 0.2;
const MAX_SAMPLES = 64;
/** How unsure the timing is, s: a fixed part plus a share of how far ahead it is. Movers are kept clear over that whole window. */
const SURE = 0.05;
const UNSURE = 0.06;
/** Extra room kept from spikes on top of the radius, m. */
const SPIKE_ROOM = 0.1;

const m: Point = { x: 0, z: 0 };

/**
 * One way through a mover zone: a straight walk from the agent to a lane
 * entry, then straight on across the zone. It is sampled every STEP m with
 * the time the agent reaches each sample, from a simple model of how it
 * speeds up and turns, so the plan can be checked against the walls, the
 * spikes and every mover. Its arrays are reused, so planning allocates
 * nothing.
 */
export class Trajectory {
  readonly x = new Float64Array(MAX_SAMPLES);
  readonly z = new Float64Array(MAX_SAMPLES);
  readonly t = new Float64Array(MAX_SAMPLES);
  n = 0;

  /**
   * From (x0, z0) to (qx, qz), then `cross` m along (cx, cz). The agent
   * starts at speed v0 (m/s), first needs `delay` s to turn, then speeds up
   * at `accel` to `top`.
   */
  build(x0: number, z0: number, qx: number, qz: number, cx: number, cz: number, cross: number, v0: number, delay: number, top: number, accel: number): this {
    const first = Math.hypot(qx - x0, qz - z0);
    const total = first + cross;
    this.n = 0;
    for (let s = 0; s <= total + 1e-9 && this.n < MAX_SAMPLES; s += STEP) {
      const i = this.n++;
      if (s <= first && first > 1e-9) {
        this.x[i] = x0 + ((qx - x0) * s) / first;
        this.z[i] = z0 + ((qz - z0) * s) / first;
      } else {
        this.x[i] = qx + cx * (s - first);
        this.z[i] = qz + cz * (s - first);
      }
      this.t[i] = delay + timeToCover(s, Math.max(0, v0), top, accel);
    }
    return this;
  }

  /**
   * Whether every sample keeps the agent clear of walls, crates and spikes,
   * by `room` m from solids. A negative room lets a plan slide along a wall
   * it already touches.
   */
  clearOfSolids(course: Course, radius: number, room = 0.02): boolean {
    for (let i = 0; i < this.n; i++) {
      if (deepestOverlap(this.x[i], this.z[i], radius + room, course.solidData, course.solids.length) > 0) return false;
      if (deepestOverlap(this.x[i], this.z[i], radius + SPIKE_ROOM, course.spikeData, course.spikes.length) > 0) return false;
    }
    return true;
  }

  /**
   * The closest any mover comes to the agent along the plan, m past its
   * radius and clearance (negative means a touch), when the agent stands
   * still `wait` s and then sets off, from episode time `now`. Each sample
   * is checked against where the mover may be over a window round its
   * time, since the walk will not keep the model's pace exactly. It stops
   * early once the room falls below `giveUp`.
   */
  moverRoom(course: Course, zones: Float64Array, radius: number, now: number, wait: number, giveUp = -Infinity): number {
    const reach = radius + MOVER_CLEARANCE;
    let worst = Infinity;
    // Standing at the start while it waits. Outside every mover zone nothing can reach it.
    if (wait > 0 && zoneAt(zones, this.x[0], this.z[0]) >= 0) {
      for (let w = 0; w <= wait + 1e-9 && worst >= giveUp; w += 0.1) worst = Math.min(worst, roomAt(course, zones, this.x[0], this.z[0], now + w, 0, reach));
    }
    for (let i = 0; i < this.n && worst >= giveUp; i++) {
      if (zoneAt(zones, this.x[i], this.z[i]) < 0) continue;
      const at = now + wait + this.t[i];
      const slack = SURE + UNSURE * this.t[i];
      worst = Math.min(worst, roomAt(course, zones, this.x[i], this.z[i], at, slack, reach));
    }
    return worst;
  }

  /** Whether the plan keeps clear of every mover (see moverRoom), stopping at the first sample that does not. */
  clearOfMovers(course: Course, zones: Float64Array, radius: number, now: number, wait: number): boolean {
    return this.moverRoom(course, zones, radius, now, wait, 0) >= 0;
  }

  /** Time to reach the plan's last sample, s. */
  get duration(): number {
    return this.n > 0 ? this.t[this.n - 1] : 0;
  }
}

/** Seconds to cover `s` m from speed v0, speeding up at `accel` to `top`. */
function timeToCover(s: number, v0: number, top: number, accel: number): number {
  if (v0 >= top) return s / top;
  const ramp = (top * top - v0 * v0) / (2 * accel);
  if (s <= ramp) return (-v0 + Math.sqrt(v0 * v0 + 2 * accel * s)) / accel;
  return (top - v0) / accel + (s - ramp) / top;
}

/** Room between a circle of radius `reach` at (x, z) and every mover whose zone holds it, over [t - slack, t + slack], m. */
function roomAt(course: Course, zones: Float64Array, x: number, z: number, t: number, slack: number, reach: number): number {
  let worst = Infinity;
  for (let k = 0; k < course.movers.length; k++) {
    const o = k * 4;
    if (Math.abs(x - zones[o]) >= zones[o + 2] || Math.abs(z - zones[o + 1]) >= zones[o + 3]) continue;
    const mv = course.movers[k];
    // The mover's box over the window: the box of where it is at both ends and the middle.
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let j = -1; j <= 1; j++) {
      moverPosition(mv, t + j * slack, m);
      x0 = Math.min(x0, m.x);
      x1 = Math.max(x1, m.x);
      z0 = Math.min(z0, m.z);
      z1 = Math.max(z1, m.z);
      if (slack === 0) break;
    }
    const dx = Math.max(0, Math.max(x0 - mv.hx - x, x - x1 - mv.hx));
    const dz = Math.max(0, Math.max(z0 - mv.hz - z, z - z1 - mv.hz));
    worst = Math.min(worst, Math.hypot(dx, dz) - reach);
  }
  return worst;
}

import type { Course } from '../course/build';
import { sampleFlow } from '../course/fieldSample';
import { moverPosition, type Point } from '../course/movers';

/** How far ahead the navigator looks when timing a mover, s, and the step of that look. */
export const HORIZON = 1.5;
const STEP = 0.1;
/** Room the navigator keeps from a mover's edge, m, on top of its radius. */
const MARGIN = 0.18;

const p: Point = { x: 0, z: 0 };
const flow: Point = { x: 0, z: 0 };
const m: Point = { x: 0, z: 0 };

/** Whether a circle at (x, z) of radius r meets any mover as it stands at `time`. */
function hitsMover(course: Course, x: number, z: number, r: number, time: number): boolean {
  for (let k = 0; k < course.movers.length; k++) {
    const mv = course.movers[k];
    moverPosition(mv, time, m);
    const dx = Math.max(0, Math.abs(x - m.x) - mv.hx);
    const dz = Math.max(0, Math.abs(z - m.z) - mv.hz);
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

/**
 * Whether a plan keeps clear of every mover for the next HORIZON seconds.
 * `speed` is how fast the agent will walk along the path hint, m/s: 0 to
 * stand still, negative to back away along it. Walls are ignored; the
 * plan only asks whether a mover would reach it first.
 */
export function planIsSafe(course: Course, x: number, z: number, radius: number, time: number, speed: number): boolean {
  if (course.movers.length === 0) return true;
  p.x = x;
  p.z = z;
  const r = radius + MARGIN;
  for (let t = 0; t <= HORIZON + 1e-9; t += STEP) {
    if (hitsMover(course, p.x, p.z, r, time + t)) return false;
    if (speed !== 0) {
      sampleFlow(course.field, p.x, p.z, flow);
      p.x += flow.x * speed * STEP;
      p.z += flow.z * speed * STEP;
    }
  }
  return true;
}

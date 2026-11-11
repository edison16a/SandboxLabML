import { wrapAngle } from '../../core/math';
import type { Course } from '../course/build';
import { sampleFlow } from '../course/fieldSample';
import { deepestOverlap } from '../kinematics/collide';
import type { NavigationParams } from '../params';

/** How long after leaving a lane the walk is followed, s, and the step, s. */
const AFTER = 0.6;
const STEP = 0.05;
/** Room kept from spikes on the way, m on top of the radius. */
const ROOM = 0.04;

const flow = { x: 0, z: 0 };

/**
 * Whether an agent leaving a mover lane at (x, z) at full stride along
 * (cx, cz) can turn back onto the path hint without touching spikes. It
 * follows the hint the way the navigator does: turning at its turn rate
 * and slowing in a sharp turn. A lane that runs straight at a spike pad a
 * meter past the mover is no use, however well it is timed; one that
 * only passes near spikes the path bends round is fine.
 */
export function leavesSafely(course: Course, params: NavigationParams, x: number, z: number, cx: number, cz: number, top: number): boolean {
  if (course.spikes.length === 0) return true;
  const ag = params.agent;
  let yaw = Math.atan2(-cz, cx);
  let speed = top;
  for (let t = 0; t < AFTER; t += STEP) {
    sampleFlow(course.field, x, z, flow);
    const bearing = wrapAngle(Math.atan2(-flow.z, flow.x) - yaw);
    const turn = Math.max(-1, Math.min(1, bearing * 3)) * ag.turnRate;
    yaw += turn * STEP;
    const want = Math.abs(bearing) > 1.3 ? 0.15 * top : Math.abs(bearing) > 0.6 ? 0.6 * top : top;
    speed += Math.max(-ag.accel * STEP, Math.min(ag.accel * STEP, want - speed));
    x += Math.cos(yaw) * speed * STEP;
    z -= Math.sin(yaw) * speed * STEP;
    if (deepestOverlap(x, z, ag.radius + ROOM, course.spikeData, course.spikes.length) > 0) return false;
  }
  return true;
}

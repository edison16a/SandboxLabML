import { createNavAgent, type NavAgent } from '../agent';
import { buildCourse, type Course } from '../course/build';
import type { CourseSpec, ObstacleSpec } from '../course/types';
import { DEFAULT_NAVIGATION_PARAMS } from '../params';
import type { CollisionWorld } from '../kinematics/slide';
import { moverPosition } from '../course/movers';

export const params = DEFAULT_NAVIGATION_PARAMS;
export const R = params.agent.radius;

/** A test room of the given obstacles, 14 m wide and 30 m long unless told otherwise. */
export function room(obstacles: ObstacleSpec[], length = 30, width = 14): Course {
  const spec: CourseSpec = { id: 'test', name: 'Test', level: 0, length, width, obstacles };
  return buildCourse(spec, params);
}

/** A collision world for a course with its movers placed at `time`. */
export function worldAt(course: Course, time = 0): CollisionWorld {
  const movers = new Float64Array(course.movers.length * 4);
  const p = { x: 0, z: 0 };
  course.movers.forEach((m, k) => {
    moverPosition(m, time, p);
    movers.set([p.x, p.z, m.hx, m.hz], k * 4);
  });
  return { solids: course.solidData, solidCount: course.solids.length, movers, moverCount: course.movers.length };
}

/** An agent standing at (x, z) facing `yaw`. */
export function agentAt(course: Course, x: number, z: number, yaw = 0, rays = 12): NavAgent {
  const a = createNavAgent(0, course, params, rays, 1);
  a.x = x;
  a.z = z;
  a.yaw = yaw;
  return a;
}

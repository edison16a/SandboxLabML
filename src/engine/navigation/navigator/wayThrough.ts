import { buildCourse, isSolvable } from '../course/build';
import type { BlockSpec, CourseSpec, MoverSpec } from '../course/types';
import { NavigationEnv } from '../env';
import { DEFAULT_NAVIGATION_PARAMS, type NavigationParams } from '../params';
import { STANDARD_NAVIGATION_INPUTS } from '../sensors/inputConfig';
import { IDLE_BRAIN, navigatorController } from './navigator';

/** Start spots the check walks from, the exam's: the middle of the front row, far left in it, and one row back. */
export const WAY_SLOTS = [0, 9, 25] as const;

/** Why a course has no way through: walls and pieces close it, or the movers never leave a gap. */
export type NoWay = 'blocked' | 'movers';

/**
 * The floor a mover covers at every moment of its trip: where its crate at
 * one end of the path overlaps its crate at the other. The crate slides in
 * a straight line between them, so it covers that floor all the way.
 * Null when the path is longer than the crate, which then opens up.
 */
export function moverCore(m: MoverSpec): BlockSpec | null {
  const minX = Math.max(m.ax, m.bx) - m.hx;
  const maxX = Math.min(m.ax, m.bx) + m.hx;
  const minZ = Math.max(m.az, m.bz) - m.hz;
  const maxZ = Math.min(m.az, m.bz) + m.hz;
  if (minX >= maxX || minZ >= maxZ) return null;
  return { kind: 'block', x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hx: (maxX - minX) / 2, hz: (maxZ - minZ) / 2, height: m.height };
}

/**
 * Whether a runner can get from the start to the finish, or why not. The
 * distance field sees walls, crates and spikes but walks through movers,
 * so first the floor a mover never leaves counts as a crate. A course
 * with movers then has to be finished by the perfect scripted navigator
 * from at least one of WAY_SLOTS, since a mover can close a gap for good
 * without covering it at every moment (say a long one in a narrow lane).
 * The check takes a few milliseconds, so the editor runs it once per edit.
 */
export function noWayThrough(spec: CourseSpec, params: NavigationParams = DEFAULT_NAVIGATION_PARAMS): NoWay | null {
  const movers = spec.obstacles.filter((o): o is MoverSpec => o.kind === 'mover');
  const cores = movers.map(moverCore).filter((c) => c !== null);
  // The field leaves movers out, so with no cores the course itself is the static check.
  const course = buildCourse(spec, params);
  const still = cores.length ? buildCourse({ ...spec, obstacles: [...spec.obstacles.filter((o) => o.kind !== 'mover'), ...cores] }, params) : course;
  if (!isSolvable(still)) return isSolvable(course) ? 'movers' : 'blocked';
  if (!movers.length) return null;
  // One spot at a time, stopping at the first finish: most courses need only the first walk.
  for (let k = 0; k < WAY_SLOTS.length; k++) {
    const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: navigatorController(course, params) });
    env.reset([IDLE_BRAIN], [k + 1], [WAY_SLOTS[k]]);
    while (!env.done) env.step();
    if (env.results()[0].finished) return null;
  }
  return 'movers';
}

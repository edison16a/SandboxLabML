import type { Course } from '@/engine/navigation/course/build';
import { WALL_HEIGHT } from '@/engine/navigation/course/types';
import { fitDistance, type ScreenWindow } from '@/render/hideseek/camera/fit';
import { orbitShot, type Shot } from '@/render/hideseek/camera/framing';

/**
 * The follow shot: a drone behind the runner and a little to its side,
 * looking down the course toward the finish, high enough to see over the
 * walls and far enough to read what is coming. The aim leads the runner by
 * a couple of meters, so more of the way ahead is in frame than behind.
 * Stiffness (1/s, in simulation time) sets how closely the aim trails it.
 */
export const FOLLOW = {
  distance: 12.5,
  elevation: (45 * Math.PI) / 180,
  /** Round from the +z side toward +x: -90 degrees is straight behind a runner heading +x. Off to the side, so the pack behind runs across the frame, not into the lens. */
  azimuth: (-54 * Math.PI) / 180,
  height: 0.8,
  lead: 1.3,
  stiffness: 3.2,
};

/** Elevation of the overview: steep enough to see past every wall, low enough to read the course in depth. */
const OVERVIEW_ELEVATION = (48 * Math.PI) / 180;
const TOP = Math.PI / 2 - 1e-3;
/** The course shots keep clear of the HUD along the top and bottom. */
const FILL: ScreenWindow = { h: 0.94, up: 0.8, down: 0.8 };

/** The follow shot of a runner at (x, z). */
export function followShot(x: number, z: number): Shot {
  return orbitShot(x + FOLLOW.lead, z, FOLLOW.distance, FOLLOW.elevation, FOLLOW.azimuth, FOLLOW.height);
}

/** The whole course at an angle from its side, start on the left and finish on the right. */
export function overviewShot(course: Course, fovDeg: number, aspect: number): Shot {
  const d = fitDistance(course.spec.length + 1.5, course.spec.width + 1.5, fovDeg, aspect, OVERVIEW_ELEVATION, 0, FILL);
  return orbitShot(0, 0, d, OVERVIEW_ELEVATION, 0, WALL_HEIGHT * 0.2);
}

/** The whole course straight from above. */
export function topShot(course: Course, fovDeg: number, aspect: number): Shot {
  return orbitShot(0, 0, fitDistance(course.spec.length + 1.5, course.spec.width + 1.5, fovDeg, aspect, TOP, 0, FILL), TOP);
}

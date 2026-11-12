import type { Course } from '@/engine/navigation/course/build';
import { FINISH_INSET, WALL_HEIGHT } from '@/engine/navigation/course/types';
import { fitDistance, type ScreenWindow } from '@/render/navigation/camera/fit';
import { orbitShot, type Shot } from '@/render/navigation/camera/framing';

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
  height: 0.8,
  lead: 1.3,
  stiffness: 3.2,
  /** How briskly the camera swings round to the other side of the runner, 1/s in simulation time: a slow, even glide. */
  swing: 1.3,
};

/**
 * Azimuth of the follow shot, round from the +z side toward +x: -90
 * degrees is straight behind a runner heading +x. It sits off to one side,
 * so the pack behind runs across the frame rather than into the lens:
 * -54 degrees on the +z side, mirrored to -126 on the -z side.
 */
const SIDE_AZIMUTH = (-54 * Math.PI) / 180;

export function followAzimuth(side: number): number {
  return side >= 0 ? SIDE_AZIMUTH : -Math.PI - SIDE_AZIMUTH;
}

/** How far off the middle of the room the runner goes before the camera moves round to its side, m. */
export const SWING_AT = 2;
/** Share of the runner's distance from the middle of the room that the aim is pulled back toward the middle. */
export const CENTER_PULL = 0.4;

/**
 * Which side the follow camera sits on (1 for +z, -1 for -z) for a runner
 * at z: the side of the wall it is near, so the camera looks across the
 * room from over that wall, with the way ahead and the room beyond the
 * runner, not the city over the far wall. Between the two thresholds it
 * keeps the side it had, so it never swings back and forth.
 */
export function followSide(z: number, side: number): number {
  if (z > SWING_AT) return 1;
  if (z < -SWING_AT) return -1;
  return side;
}

/**
 * Where the follow shot aims for a runner at (x, z) in a room of half size
 * (hx, hz): a little ahead of it, pulled part of the way back toward the
 * middle of the room, and never past the finish line, so a runner by a
 * wall or at the line is framed with the course round it rather than the
 * city behind the walls.
 */
export function followAim(x: number, z: number, hx: number, hz: number, out: { x: number; z: number }): void {
  out.x = Math.max(-hx, Math.min(hx - FINISH_INSET, x + FOLLOW.lead));
  out.z = Math.max(-hz, Math.min(hz, z)) * (1 - CENTER_PULL);
}

/** Elevation of the overview: steep enough to see past every wall, low enough to read the course in depth. */
const OVERVIEW_ELEVATION = (48 * Math.PI) / 180;
const TOP = Math.PI / 2 - 1e-3;
/** The course shots keep clear of the HUD along the top and bottom. */
const FILL: ScreenWindow = { h: 0.94, up: 0.8, down: 0.8 };

const aim = { x: 0, z: 0 };

/** The follow shot of a runner at (x, z) in a room of half size (hx, hz), from side `side` (see followSide). */
export function followShot(x: number, z: number, hx: number, hz: number, side = 1): Shot {
  followAim(x, z, hx, hz, aim);
  return orbitShot(aim.x, aim.z, FOLLOW.distance, FOLLOW.elevation, followAzimuth(side), FOLLOW.height);
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

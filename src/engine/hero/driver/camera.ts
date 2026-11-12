import type { DrivingEnv } from '../../driving/env';

/**
 * Where the hero's chase camera rides relative to the SUV: between `near`
 * and `far` m behind it, turned `side` rad round to its left, over the
 * middle of the road. The camera itself is in the landing page's renderer;
 * the numbers live here so the trip judge can keep traffic off that spot.
 */
export const CHASE_SPOT = { near: 10, far: 14, side: (6 * Math.PI) / 180 };

/**
 * A traffic car whose middle comes this close to the camera's line, m,
 * passes through the lens, fills the frame or blocks the view of the SUV.
 * Toward the SUV's left less room is needed: the page shifts the lens so
 * the picture reaches far to the right of the line and only a little to
 * its left, and an oncoming car leaves the frame well before it passes
 * the camera.
 */
const CLEAR_RIGHT = 2.6;
const CLEAR_LEFT = 1.3;
/** The line starts this far behind the SUV's middle, m, just past its tail. */
const LINE_START = 3;

/**
 * True when a traffic car is on or beside the camera's line of sight: from
 * just behind the SUV out to `far` m back, where the camera hangs. Traffic
 * cannot see the SUV, so a car can follow it close behind.
 */
export function carAtCamera(env: DrivingEnv): boolean {
  const car = env.learners[0].car;
  const world = env.world.state;
  // Behind the SUV and turned toward its left: the heading plus a half turn, less the side angle.
  const bx = -Math.cos(car.heading - CHASE_SPOT.side);
  const by = -Math.sin(car.heading - CHASE_SPOT.side);
  // The SUV's left, the way the camera looks.
  const nx = -Math.sin(car.heading);
  const ny = Math.cos(car.heading);
  for (let i = 0; i < world.carCount; i++) {
    const dx = world.carX[i] - car.x;
    const dy = world.carY[i] - car.y;
    if (dx * dx + dy * dy > 30 * 30) continue;
    // The nearest point of the stretch of line the camera rides on, then the gap from it, along the line and across.
    const along = Math.min(CHASE_SPOT.far, Math.max(LINE_START, dx * bx + dy * by));
    const gx = dx - bx * along;
    const gy = dy - by * along;
    const lon = gx * bx + gy * by;
    const lat = gx * nx + gy * ny;
    if (Math.abs(lon) < CLEAR_RIGHT && lat > -CLEAR_RIGHT && lat < CLEAR_LEFT) return true;
  }
  return false;
}

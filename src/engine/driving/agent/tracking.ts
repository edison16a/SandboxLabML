import { wrapAngle } from '../../core/math';
import { SUV_SIZE } from '../car/params';
import { ELEMENT_CONNECTOR, type City } from '../city/types';
import { projection } from '../geometry/path';
import { DEST_HALF, type Route } from '../route/route';
import { CURVE_FAR, CURVE_NEAR } from '../sensors/inputConfig';
import type { DrivingLearner } from './learner';

const proj = projection();
/** Samples searched either side of last tick's position. At 24 m/s a car covers under a meter a tick. */
const WINDOW = 14;
/** New ground under this many meters a tick does not count as progress. */
const PROGRESS_EPS = 0.02;
/**
 * How far ahead along the lane the aim input looks: 3 m plus about half a
 * second of driving, 4 to 10 m. Like a driver's eyes, it looks further the
 * faster the car goes, and close enough in a tight turn that steering at it
 * follows the curb instead of cutting across it.
 */
export const AIM_MIN = 4;
export const AIM_MAX = 10;

export function aimDistance(speed: number): number {
  return Math.min(AIM_MAX, Math.max(AIM_MIN, 3 + 0.45 * speed));
}

/**
 * Where the learner is on its route after a physics step: progress, offset
 * from the lane, heading error, the curve ahead, the speed limit and the
 * next maneuver. One windowed projection plus a few lookups.
 */
export function trackRoute(l: DrivingLearner, city: City, route: Route): void {
  const p = route.path;
  p.project(l.car.x, l.car.y, l.routeIndex, WINDOW, proj);
  l.routeIndex = proj.index;
  l.progress = proj.s;
  l.lateral = proj.lateral;
  l.headingError = wrapAngle(l.car.heading - Math.atan2(p.ty[proj.index], p.tx[proj.index]));
  l.curveNear = p.k[p.indexAt(proj.s + CURVE_NEAR, proj.index)];
  l.curveFar = p.k[p.indexAt(proj.s + CURVE_FAR, proj.index)];
  l.speedLimit = route.sampleLimit[proj.index];
  const aim = p.indexAt(proj.s + aimDistance(l.car.speed), proj.index);
  l.aim = wrapAngle(Math.atan2(p.y[aim] - l.car.y, p.x[aim] - l.car.x) - l.car.heading);
  l.remaining = route.destS - proj.s;
  l.inDestination = Math.abs(l.remaining) < DEST_HALF;
  // Ground past the destination earns nothing: the trip ends there.
  const reached = Math.min(proj.s, route.destS + DEST_HALF);
  l.progressGain = 0;
  if (reached > l.maxProgress + PROGRESS_EPS) {
    l.progressGain = reached - l.maxProgress;
    l.maxProgress = reached;
  }
  const element = city.elements[route.elements[route.sampleElement[proj.index]]];
  l.inIntersection = element.kind === ELEMENT_CONNECTOR;
  // The current turn while in it, else the next one ahead; straight on once past the last.
  l.nextTurn = 0;
  l.turnDistance = route.destS - proj.s;
  for (let k = 0; k < route.turns.length; k++) {
    const t = route.turns[k];
    if (t.end > proj.s) {
      l.nextTurn = t.turn;
      l.turnDistance = Math.max(0, t.s - proj.s - SUV_SIZE.length / 2);
      break;
    }
  }
  // A projection pinned far from the path means the car left its route: a wrong turn or worse.
  l.lost = proj.distance > 6 || Math.abs(proj.lateral) > 6;
}

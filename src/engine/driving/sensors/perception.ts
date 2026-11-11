import { isOnRoad } from '../city/surface';
import type { City } from '../city/types';
import { projection, type Path } from '../geometry/path';
import type { Route } from '../route/route';
import { LIGHT_FLASHING, lightState } from '../signals/plan';
import { PED_WALK, type WorldState } from '../world/state';
import { crossingPerson, NOT_AT_CROSSING } from './crossings';
import type { Nearby } from './nearby';
import { CAR_CORRIDOR, GAP_RANGE, PED_CORRIDOR, PED_RANGE, STOP_RANGE } from './inputConfig';

/**
 * What a driver knows about the road ahead beyond its lidar: the signal it
 * is heading for, the car in front in its lane and the nearest person in
 * its path. People on the sidewalk do not count, only those in the road in
 * front of the car or on (or stepping onto) a crossing it will drive over. Learners, the autopilot and the 3D overlay all fill this
 * the same way.
 */
export interface Perception {
  /** Index into route.stops of the next stop line, or -1 past the last. */
  stop: number;
  /** The light at that stop line (LIGHT_*), or -1 when no signal is ahead. */
  light: number;
  /** Front bumper to that stop line, m; STOP_RANGE when there is none. */
  lightDistance: number;
  /** City signal index of that light, or -1. */
  signal: number;
  /** World index of the car ahead, its bumper to bumper gap and its speed relative to ours (negative when closing). */
  car: number;
  gap: number;
  relSpeed: number;
  /** World index of the person, how far ahead of the front bumper and how far to the side of the path (left positive). */
  ped: number;
  pedDistance: number;
  pedLateral: number;
}

export function perception(): Perception {
  return { stop: -1, light: -1, lightDistance: STOP_RANGE, signal: -1, car: -1, gap: GAP_RANGE, relSpeed: 0, ped: -1, pedDistance: PED_RANGE, pedLateral: 0 };
}

/** Where a driver is on its route this tick. */
export interface RoutePose {
  x: number;
  y: number;
  heading: number;
  speed: number;
  /** Route arc length of the car's center and the nearest route sample. */
  progress: number;
  index: number;
  /** Half the car's length, m. */
  half: number;
}

const proj = projection();

/** Projects a world point onto the route near where it should be: `ahead` meters past the driver. */
function onRoute(path: Path, pose: RoutePose, px: number, py: number, ahead: number): boolean {
  const hint = path.indexAt(pose.progress + ahead, pose.index);
  path.project(px, py, hint, 10, proj);
  return proj.distance < 8;
}

/** True when person i is on, or about to step onto, a crossing the route passes over ahead of the front bumper. */
function atRouteCrossing(city: City, route: Route, world: WorldState, i: number, front: number): boolean {
  const list = route.crossings;
  for (let k = 0; k < list.length; k++) {
    const c = list[k];
    if (c.s1 < front - 0.5 || c.s0 > front + PED_RANGE) continue;
    if (crossingPerson(city, world, c.crosswalk, i) !== NOT_AT_CROSSING) return true;
  }
  return false;
}

/** Fills `out` for a driver at `pose` on `route`, from the cars and people in `near`. Allocation free. */
export function perceive(city: City, route: Route, world: WorldState, near: Nearby, pose: RoutePose, out: Perception): Perception {
  const front = pose.progress + pose.half;
  // The next stop line still ahead of the front bumper (a car may creep a meter past it and still count as waiting).
  let k = out.stop < 0 ? 0 : out.stop;
  while (k < route.stops.length && route.stops[k].s < front - 1) k++;
  out.stop = k < route.stops.length ? k : -1;
  out.light = -1;
  out.signal = -1;
  out.lightDistance = STOP_RANGE;
  if (out.stop >= 0) {
    const st = route.stops[out.stop];
    const d = st.s - front;
    if (d < STOP_RANGE) {
      out.signal = st.signal;
      out.light = world.signalsOn ? lightState(world.time, city.signalOffsets[st.signal], st.axis) : LIGHT_FLASHING;
      out.lightDistance = Math.max(d, 0);
    }
  }
  const path = route.path;
  const ch = Math.cos(pose.heading);
  const sh = Math.sin(pose.heading);
  out.car = -1;
  out.gap = GAP_RANGE;
  out.relSpeed = 0;
  const carReach = (GAP_RANGE + 6) * (GAP_RANGE + 6);
  for (let n = 0; n < near.carCount; n++) {
    const i = near.cars[n];
    const dx = world.carX[i] - pose.x;
    const dy = world.carY[i] - pose.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > carReach || dx * ch + dy * sh < 0) continue;
    const align = Math.cos(world.carHeading[i] - pose.heading);
    if (align < 0.3 || !onRoute(path, pose, world.carX[i], world.carY[i], Math.sqrt(d2))) continue;
    const ds = proj.s - pose.progress;
    if (ds <= 0 || Math.abs(proj.lateral) > CAR_CORRIDOR) continue;
    const gap = ds - pose.half - world.carLength[i] / 2;
    if (gap < out.gap) {
      out.car = i;
      out.gap = Math.max(gap, 0);
      out.relSpeed = world.carSpeed[i] * align - pose.speed;
    }
  }
  out.ped = -1;
  out.pedDistance = PED_RANGE;
  out.pedLateral = 0;
  const pedReach = (PED_RANGE + 6) * (PED_RANGE + 6);
  for (let n = 0; n < near.pedCount; n++) {
    const i = near.peds[n];
    const dx = world.pedX[i] - pose.x;
    const dy = world.pedY[i] - pose.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > pedReach || dx * ch + dy * sh < 0) continue;
    // Someone strolling along the sidewalk never counts: skip them before the costlier projection.
    const onRoad = isOnRoad(city, world.pedX[i], world.pedY[i]);
    if (!onRoad && world.pedState[i] === PED_WALK) continue;
    if (!onRoute(path, pose, world.pedX[i], world.pedY[i], Math.sqrt(d2))) continue;
    const ds = proj.s - front;
    if (ds <= -0.5 || ds >= out.pedDistance) continue;
    const lateral = proj.lateral;
    // People on the sidewalk are no hazard. Someone in the road counts when in the car's path, or on a crossing it will drive over.
    const inPath = onRoad && Math.abs(lateral) <= PED_CORRIDOR;
    if (!inPath && !atRouteCrossing(city, route, world, i, front)) continue;
    out.ped = i;
    out.pedDistance = Math.max(ds, 0);
    out.pedLateral = lateral;
  }
  return out;
}

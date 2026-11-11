import { DIR_X, DIR_Y, STOP_LINE } from '../city/dimensions';
import { isOnRoad } from '../city/surface';
import type { City } from '../city/types';
import { projection } from '../geometry/path';
import type { Route } from '../route/route';
import { crossingBusy } from '../sensors/crossings';
import type { WorldState } from '../world/state';

const proj = projection();

/**
 * Closest thing in the road ahead the autopilot must stop behind, as the
 * distance from the car's center along the route to where its front should
 * come to rest. Infinity when the way is clear. Looks at other cars in or
 * cutting into the path (where they are and where they will be in a
 * second), at people on the road surface in the path, and at crossings the
 * route passes over that someone is on or about to step onto.
 */
export function hazardAhead(city: City, route: Route, world: WorldState, progress: number, index: number, half: number, reach: number): number {
  const path = route.path;
  let best = Infinity;
  for (let i = 0; i < world.carCount; i++) {
    for (let t = 0; t < 2; t++) {
      // Where the car is, and where it will be in a second if it keeps going.
      const lead = t === 0 ? 0 : 1;
      const x = world.carX[i] + Math.cos(world.carHeading[i]) * world.carSpeed[i] * lead;
      const y = world.carY[i] + Math.sin(world.carHeading[i]) * world.carSpeed[i] * lead;
      const dx = x - path.x[index];
      const dy = y - path.y[index];
      const d = Math.hypot(dx, dy);
      if (d > reach) continue;
      path.project(x, y, path.indexAt(progress + d, index), 12, proj);
      const ahead = proj.s - progress;
      if (ahead <= 0 || proj.distance > 6 || Math.abs(proj.lateral) > 1 + world.carWidth[i] / 2 + 0.6) continue;
      const stop = ahead - half - world.carLength[i] / 2 - 2.5;
      if (stop < best) best = stop;
    }
  }
  for (let i = 0; i < world.pedCount; i++) {
    const dx = world.pedX[i] - path.x[index];
    const dy = world.pedY[i] - path.y[index];
    const d = Math.hypot(dx, dy);
    if (d > reach || !isOnRoad(city, world.pedX[i], world.pedY[i])) continue;
    path.project(world.pedX[i], world.pedY[i], path.indexAt(progress + d, index), 12, proj);
    const ahead = proj.s - progress;
    if (ahead <= 0 || proj.distance > 6 || Math.abs(proj.lateral) > 3.2) continue;
    const stop = ahead - half - 3;
    if (stop < best) best = stop;
  }
  for (let k = 0; k < route.crossings.length; k++) {
    const c = route.crossings[k];
    if (c.s1 < progress - half || c.s0 > progress + reach) continue;
    if (!crossingBusy(city, world, c.crosswalk)) continue;
    const stop = c.s0 - progress - half - 1.2;
    // Already on the crossing: keep going rather than stop on top of it.
    if (stop > -0.5 && stop < best) best = Math.max(stop, 0);
  }
  return best;
}

/**
 * True when an oncoming car would cut across a left turn at `node` made by
 * a car travelling in direction `dir`: something coming the other way down
 * the far arm within 45 m, or already in the intersection from it.
 */
export function oncomingTraffic(city: City, world: WorldState, node: number, dir: number): boolean {
  const n = city.nodes[node];
  const fx = DIR_X[dir];
  const fy = DIR_Y[dir];
  for (let i = 0; i < world.carCount; i++) {
    const dx = world.carX[i] - n.x;
    const dy = world.carY[i] - n.y;
    const along = dx * fx + dy * fy;
    const across = -dx * fy + dy * fx;
    // Coming toward us means heading against our direction.
    const facing = Math.cos(world.carHeading[i]) * fx + Math.sin(world.carHeading[i]) * fy;
    if (facing > -0.5 || along < -STOP_LINE || along > 45 || across < -1 || across > 4.5) continue;
    if (world.carSpeed[i] > 0.5 || along < STOP_LINE + 6) return true;
  }
  return false;
}

/** True while a car from the crossing street is still inside the intersection. */
export function crossTrafficInBox(city: City, world: WorldState, node: number, dir: number): boolean {
  const n = city.nodes[node];
  for (let i = 0; i < world.carCount; i++) {
    const dx = world.carX[i] - n.x;
    const dy = world.carY[i] - n.y;
    if (Math.abs(dx) > STOP_LINE - 2 || Math.abs(dy) > STOP_LINE - 2) continue;
    const c = Math.abs(Math.cos(world.carHeading[i]));
    const crossing = dir % 2 === 0 ? c < 0.5 : c > 0.5;
    if (crossing) return true;
  }
  return false;
}

import { DIR_X, DIR_Y, LEFT_TURN_RADIUS, RIGHT_TURN_RADIUS, STOP_LINE } from '../city/dimensions';
import { isOnRoad } from '../city/surface';
import type { City } from '../city/types';
import { projection } from '../geometry/path';
import type { Route } from '../route/route';
import { crossingBusy } from '../sensors/crossings';
import { FLAG_LEFT, FLAG_RIGHT, type WorldState } from '../world/state';

const proj = projection();
/** Seconds ahead at which other cars' positions are predicted. */
const PREDICT = [0, 0.6, 1.2, 1.8];

/** True when (x, y) lies inside a junction box, between the stop lines of the nearest node. */
function inJunction(city: City, x: number, y: number): boolean {
  let dx = Infinity;
  let dy = Infinity;
  for (let i = 0; i < city.xs.length; i++) dx = Math.min(dx, Math.abs(x - city.xs[i]));
  for (let j = 0; j < city.ys.length; j++) dy = Math.min(dy, Math.abs(y - city.ys[j]));
  return dx < STOP_LINE && dy < STOP_LINE;
}

/** Path curvature of a traffic car turning through a junction, from its indicator, 1/m (left positive). */
function turnCurvature(flags: number): number {
  return flags & FLAG_LEFT ? 1 / LEFT_TURN_RADIUS : flags & FLAG_RIGHT ? -1 / RIGHT_TURN_RADIUS : 0;
}

/**
 * Closest thing in the road ahead the autopilot must stop behind, as the
 * distance from the car's center along the route to where its front should
 * come to rest. Infinity when the way is clear. Looks at other cars in or
 * cutting into the path (where they are and where they will be over the
 * next two seconds, round their turn if they are turning), at people on the
 * road surface in the path, and at crossings the route passes over that
 * someone is on or about to step onto.
 */
export function hazardAhead(city: City, route: Route, world: WorldState, progress: number, index: number, half: number, reach: number): number {
  const path = route.path;
  let best = Infinity;
  for (let i = 0; i < world.carCount; i++) {
    const h = world.carHeading[i];
    const v = world.carSpeed[i];
    // A car signalling inside a junction is turning: predict it round its arc, not straight on.
    const k = inJunction(city, world.carX[i], world.carY[i]) ? turnCurvature(world.carFlags[i]) : 0;
    for (let t = 0; t < PREDICT.length; t++) {
      const lead = PREDICT[t] * v;
      const x = world.carX[i] + (k === 0 ? Math.cos(h) * lead : (Math.sin(h + k * lead) - Math.sin(h)) / k);
      const y = world.carY[i] + (k === 0 ? Math.sin(h) * lead : (Math.cos(h) - Math.cos(h + k * lead)) / k);
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
 * the far arm within 45 m (or four and a half seconds at its speed), or
 * already in the intersection from it.
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
    if (facing > -0.5 || along < -STOP_LINE || along > Math.max(45, world.carSpeed[i] * 4.5) || across < -1 || across > 4.5) continue;
    if (world.carSpeed[i] > 0.5 || along < STOP_LINE + 6) return true;
  }
  return false;
}

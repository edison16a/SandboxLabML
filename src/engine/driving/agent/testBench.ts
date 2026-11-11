import { SIM_DT, SUV_SIZE } from '../car/params';
import { buildCity } from '../city/buildCity';
import { BUILT_IN_CITIES } from '../city/presets';
import { pathPoint } from '../geometry/path';
import { pickRoute } from '../route/planner';
import { buildRoute } from '../route/route';
import { Nearby } from '../sensors/nearby';
import { perceive, type RoutePose } from '../sensors/perception';
import { createWorldState, type WorldState } from '../world/state';
import { detectEvents, type ArrivalRules } from './events';
import { createLearner, type DrivingLearner } from './learner';
import { trackRoute } from './tracking';

/**
 * A small test bench for the event and contact checks: one route through
 * Midtown, learners and traffic cars placed along it, and one tick of
 * tracking, perception and event detection. Only tests import this.
 */
export const city = buildCity(BUILT_IN_CITIES[0]);
const spec = pickRoute(city, 4);
export const route = buildRoute(city, spec.elements, spec.startS, spec.destS);
const near = new Nearby();

/** A learner placed at route arc length s, offset sideways, facing along the route (plus an extra turn). */
export function learnerAt(s: number, lateral = 0, speed = 8, turn = 0): DrivingLearner {
  const l = createLearner(0, route, 9);
  const p = route.path.sample(s, pathPoint());
  l.car.x = p.x - p.ty * lateral;
  l.car.y = p.y + p.tx * lateral;
  l.car.heading = Math.atan2(p.ty, p.tx) + turn;
  l.car.speed = speed;
  l.routeIndex = p.index;
  return l;
}

/** Runs one tick of tracking, perception and event checks for a learner in a world. */
export function check(l: DrivingLearner, world: WorldState, rules?: ArrivalRules): DrivingLearner {
  trackRoute(l, city, route);
  const pose: RoutePose = { x: l.car.x, y: l.car.y, heading: l.car.heading, speed: l.car.speed, progress: l.progress, index: l.routeIndex, half: SUV_SIZE.length / 2 };
  near.gather(world, l.car.x, l.car.y);
  perceive(city, route, world, near, pose, l.sense);
  detectEvents(l, city, route, world, near, SUV_SIZE.length, SUV_SIZE.width, SIM_DT, rules);
  return l;
}

/** An empty world with signals on at time t. */
export function world(t = 0): WorldState {
  const w = createWorldState(city.signals.length);
  w.time = t;
  return w;
}

/** Puts a car in the world at route arc length s, lateral offset, facing along the route. */
export function addCar(w: WorldState, s: number, lateral = 0): void {
  const p = route.path.sample(s, pathPoint());
  const i = w.carCount++;
  w.carX[i] = p.x - p.ty * lateral;
  w.carY[i] = p.y + p.tx * lateral;
  w.carHeading[i] = Math.atan2(p.ty, p.tx);
  w.carLength[i] = 4.6;
  w.carWidth[i] = 1.85;
  w.carSpeed[i] = 0;
}

export const mid = route.startS + 4;

/** Moves a learner to route arc length s at a speed, facing along the route. */
export function moveTo(l: DrivingLearner, s: number, speed: number): void {
  const p = route.path.sample(s, pathPoint());
  l.car.x = p.x;
  l.car.y = p.y;
  l.car.heading = Math.atan2(p.ty, p.tx);
  l.car.speed = speed;
}

/** Moves world car i to route arc length s at a speed, facing along the route, plus an extra turn. */
export function moveCar(w: WorldState, i: number, s: number, speed: number, lateral = 0, turn = 0): void {
  const p = route.path.sample(s, pathPoint());
  w.carX[i] = p.x - p.ty * lateral;
  w.carY[i] = p.y + p.tx * lateral;
  w.carHeading[i] = Math.atan2(p.ty, p.tx) + turn;
  w.carSpeed[i] = speed;
}

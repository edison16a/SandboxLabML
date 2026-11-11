import { cityFor } from './city/buildCity';
import { ELEMENT_LANE, type City } from './city/types';
import { projection } from './geometry/path';
import { drivingLevel, timeLimit } from './levels';
import { chainTo, shortestTree, type RouteSpec } from './route/planner';
import { buildRoute } from './route/route';
import { cityOf } from './run/settings';
import { createDrivingSetup, type DrivingSetup } from './setup';

/**
 * A Sandbox trip as the user sets it up: a city, a level, the seed that
 * picks the route and the city's life, and optionally a destination they
 * clicked on the map, which replaces the seeded one.
 */
export interface SandboxTrip {
  /** A built in city id or `random-<seed>`. */
  city: string;
  level: number;
  seed: number;
  destination: { element: number; s: number } | null;
}

/** Room between SUVs lined up at the start, m, as DrivingEnv lays slots out. */
const SLOT_GAP = 7;
/** Room kept behind the last SUV and in front of the junction ahead, m. */
const START_MARGIN = 6;
/** The shortest trip a clicked destination may make, m, so the SUVs have somewhere to go. */
const MIN_TRIP = 30;
/** Most SUVs the Sandbox lines up. More would not fit on most first lanes. */
export const MAX_SANDBOX_CARS = 8;

/** How many SUVs fit on the first lane of a route, nose to tail, up to MAX_SANDBOX_CARS. */
export function startCapacity(city: City, route: RouteSpec): number {
  const length = city.elements[route.elements[0]].path.length;
  return Math.max(1, Math.min(MAX_SANDBOX_CARS, Math.floor((length - 2 * START_MARGIN) / SLOT_GAP) + 1));
}

/** The seeded trip's route, or the way from its start to a clicked destination when there is one. */
function routeOf(city: City, seeded: RouteSpec, destination: SandboxTrip['destination']): RouteSpec {
  if (!destination || city.elements[destination.element]?.kind !== ELEMENT_LANE) return seeded;
  const start = seeded.elements[0];
  if (destination.element === start) return destination.s > seeded.startS + MIN_TRIP ? { ...seeded, elements: [start], destS: destination.s } : seeded;
  const chain = chainTo(shortestTree(city, start), destination.element);
  return chain ? { elements: chain, startS: seeded.startS, destS: destination.s } : seeded;
}

/**
 * The setup a Sandbox trip drives. The start moves up its lane so `cars`
 * SUVs fit behind one another without overlapping, and the time limit
 * follows the trip's real length.
 */
export function sandboxSetup(trip: SandboxTrip, cars: number): DrivingSetup {
  const spec = cityOf(trip.city);
  const city = cityFor(spec);
  const level = drivingLevel(trip.level);
  const seeded = createDrivingSetup({ city: spec, level: level.id, seed: trip.seed });
  const route = routeOf(city, seeded.route, trip.destination);
  const lane = city.elements[route.elements[0]].path.length;
  const fit = Math.min(cars, startCapacity(city, route)) - 1;
  const wanted = Math.max(route.startS, SLOT_GAP * fit + START_MARGIN);
  // On a one lane trip the start may not pass the destination.
  const room = route.elements.length === 1 ? route.destS - MIN_TRIP : lane - START_MARGIN;
  const startS = Math.max(route.startS, Math.min(wanted, room));
  const built = buildRoute(city, route.elements, startS, route.destS);
  return { city: spec, level: level.id, route: { ...route, startS }, worldSeed: seeded.worldSeed, maxTime: timeLimit(built.length, built.stops.length, level.stopWait) };
}

const proj = projection();

/** The lane point nearest a spot on the map, within `reach` m, for a clicked destination. Null when no lane is that close. */
export function nearestLanePoint(city: City, x: number, y: number, reach = 6): { element: number; s: number } | null {
  let best: { element: number; s: number } | null = null;
  let bestD = reach;
  for (const e of city.elements) {
    if (e.kind !== ELEMENT_LANE) continue;
    e.path.project(x, y, 0, e.path.n, proj);
    if (proj.distance < bestD) {
      bestD = proj.distance;
      // Keep clear of both ends of the lane, where the stop line and the junction are.
      best = { element: e.id, s: Math.min(Math.max(proj.s, 8), e.path.length - 8) };
    }
  }
  return best;
}

/** How many SUVs a Sandbox trip can line up at its start. */
export function sandboxCapacity(trip: SandboxTrip): number {
  const setup = sandboxSetup(trip, 1);
  return startCapacity(cityFor(setup.city), setup.route);
}

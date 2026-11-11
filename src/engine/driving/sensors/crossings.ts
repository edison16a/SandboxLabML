import { DIR_X, DIR_Y, ROAD_HALF } from '../city/dimensions';
import type { City } from '../city/types';
import { WALK_GO } from '../signals/plan';
import { PED_WAIT, type WorldState } from '../world/state';

/** Where a person stands relative to a zebra crossing. */
export const NOT_AT_CROSSING = 0;
/** In the road on the crossing. */
export const ON_CROSSING = 1;
/** Waiting at its curb while the walk signal says go, so about to step out. */
export const STEPPING_OUT = 2;

/** People spread this far either side of a crossing's middle line, m. */
const BAND = 2.2;
/** How far past the curb a waiting person can stand and still be about to cross, m. */
const CURB_REACH = 1.5;

/**
 * How person i relates to crosswalk `id`: on it, about to step onto it, or
 * neither. Drivers, the autopilot and the sensors all use this one test, so
 * they agree on who matters at a crossing.
 */
export function crossingPerson(city: City, world: WorldState, id: number, i: number): number {
  const k = city.crosswalks[id];
  const ax = DIR_X[k.arm];
  const ay = DIR_Y[k.arm];
  const dx = world.pedX[i] - k.x;
  const dy = world.pedY[i] - k.y;
  if (Math.abs(dx * ax + dy * ay) > BAND) return NOT_AT_CROSSING;
  const across = Math.abs(-dx * ay + dy * ax);
  if (across < ROAD_HALF + 0.3) return ON_CROSSING;
  if (across > ROAD_HALF + CURB_REACH || world.pedState[i] !== PED_WAIT) return NOT_AT_CROSSING;
  const signal = city.nodes[k.node].signal;
  return world.walks[signal * 2 + k.walkAxis] === WALK_GO ? STEPPING_OUT : NOT_AT_CROSSING;
}

/** True when anyone is on crosswalk `id` or about to step onto it. */
export function crossingBusy(city: City, world: WorldState, id: number): boolean {
  for (let i = 0; i < world.pedCount; i++) if (crossingPerson(city, world, id, i) !== NOT_AT_CROSSING) return true;
  return false;
}

import { LANE_OFFSET } from '../city/dimensions';
import { isOnRoad } from '../city/surface';
import type { City } from '../city/types';
import type { Route } from '../route/route';
import { LIGHT_RED, LIGHT_YELLOW, lightState } from '../signals/plan';
import type { Nearby } from '../sensors/nearby';
import type { WorldState } from '../world/state';
import { detectContacts, WHEEL_X } from './contacts';
import type { DrivingLearner } from './learner';

/** Past the stop line by this much, the car has entered the intersection, m. */
const BOX_ENTRY = 3;
/** Sideways offset past which the body crosses a lane line, m (2 m wide car in a 3.5 m lane, plus a little slack). */
const LANE_SLACK = 1.05;
/** Braking harder than this counts as a hard stop, m/s^2. */
const HARD_BRAKE = 5.5;
/** Speeding starts this far over the limit, m/s. */
const SPEED_SLACK = 0.5;
/** How strict a level is about the curb and about stopping at the destination (see DrivingLevel). */
export interface ArrivalRules {
  lenientCurb: boolean;
  arriveSpeed: number;
}

/** The full rules: any wheel over the curb ends the episode, and arriving means stopping. */
const STRICT: ArrivalRules = { lenientCurb: false, arriveSpeed: 1.5 };

/**
 * Collisions and rule breaking for one learner after it moved. Traffic
 * cannot see the learners, so a contact only counts when the learner caused
 * it (see detectContacts). A car that rolls into a learner waiting at a
 * light simply passes through, which is the trade off of a shared city.
 */
export function detectEvents(l: DrivingLearner, city: City, route: Route, world: WorldState, near: Nearby, length: number, width: number, dt: number, rules: ArrivalRules = STRICT): void {
  const car = l.car;
  const half = length / 2;
  const front = l.progress + half;
  const light = l.sense.light;
  l.ranRedLight = false;
  l.overranStopLine = false;
  // Red lights: note the light as the front crosses the line, judge it as the car enters the box.
  const st = l.sense.stop;
  if (st >= 0 && st !== l.lineStop && front >= route.stops[st].s) {
    l.lineStop = st;
    l.lineLight = light;
  }
  if (l.lineStop >= 0 && front >= route.stops[l.lineStop].s + BOX_ENTRY && l.lineLight >= 0) {
    const line = route.stops[l.lineStop];
    const now = world.signalsOn ? lightState(world.time, city.signalOffsets[line.signal], line.axis) : -1;
    if (l.lineLight === LIGHT_RED && now === LIGHT_RED) {
      l.ranRedLight = true;
      l.redLightRuns++;
    } else if (l.lineLight === LIGHT_RED) {
      l.overranStopLine = true;
      l.stopLineOverruns++;
    }
    l.lineLight = -1;
  }
  l.speeding = car.speed > l.speedLimit + SPEED_SLACK;
  if (l.speeding) l.speedingTime += dt;
  l.laneDeparture = !l.inIntersection && Math.abs(l.lateral) > LANE_SLACK;
  l.wrongWay = !l.inIntersection && l.lateral > LANE_OFFSET;
  if (l.laneDeparture) l.laneDepartureTime += dt;
  if (l.wrongWay) l.wrongWayTime += dt;
  // Coming to rest from a crawl stops the wheels within a tick; only braking at speed is hard braking.
  const hard = car.accelLong < -HARD_BRAKE && car.speed > 2;
  if (hard && !l.hardBrake) l.hardBrakes++;
  l.hardBrake = hard;

  // The curb: any wheel over it means the car has left the road (with a lenient curb, only its center leaving
  // the road does). The bodywork may overhang a curb in a tight turn.
  const ch = Math.cos(car.heading);
  const sh = Math.sin(car.heading);
  const fx = ch * WHEEL_X;
  const fy = sh * WHEEL_X;
  const sx = -sh * (width / 2 - 0.15);
  const sy = ch * (width / 2 - 0.15);
  l.overCurb = !isOnRoad(city, car.x + fx + sx, car.y + fy + sy) || !isOnRoad(city, car.x + fx - sx, car.y + fy - sy) || !isOnRoad(city, car.x - fx + sx, car.y - fy + sy) || !isOnRoad(city, car.x - fx - sx, car.y - fy - sy);
  if (l.overCurb) l.curbTime += dt;
  l.offRoad = rules.lenientCurb ? l.overCurb && !isOnRoad(city, car.x, car.y) : l.overCurb;

  detectContacts(l, world, near, half, width / 2);
  l.arrived = l.inDestination && car.speed < rules.arriveSpeed && Math.abs(l.lateral) < 1.5;

  // Standing still is fine behind a red light, a car or a person; anything else is a stall.
  const s = l.sense;
  l.waiting = ((light === LIGHT_RED || light === LIGHT_YELLOW) && s.lightDistance < 30) || s.gap < 12 || s.pedDistance < 15;
  if (l.progressGain > 0) l.noProgress = 0;
  else if (!l.waiting) l.noProgress += dt;
}

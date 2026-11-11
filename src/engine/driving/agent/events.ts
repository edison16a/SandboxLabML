import { LANE_OFFSET } from '../city/dimensions';
import { isOnRoad } from '../city/surface';
import type { City } from '../city/types';
import type { Route } from '../route/route';
import { PED_RADIUS } from '../sensors/lidar';
import { LIGHT_RED, LIGHT_YELLOW, lightState } from '../signals/plan';
import type { Nearby } from '../sensors/nearby';
import type { WorldState } from '../world/state';
import type { DrivingLearner } from './learner';

/** Past the stop line by this much, the car has entered the intersection, m. */
const BOX_ENTRY = 3;
/** Sideways offset past which the body crosses a lane line, m (2 m wide car in a 3.5 m lane, plus a little slack). */
const LANE_SLACK = 1.05;
/** Braking harder than this counts as a hard stop, m/s^2. */
const HARD_BRAKE = 5.5;
/** Speeding starts this far over the limit, m/s. */
const SPEED_SLACK = 0.5;
/** Wheel centers ahead of and behind the car's middle, m: half the wheelbase. */
const WHEEL_X = 1.45;
/** Arrival: the car's center in the destination zone, nearly stopped and in its lane. */
const ARRIVE_SPEED = 1.5;

/** True when two oriented boxes overlap (separating axis test on the four box axes). */
function boxesOverlap(ax: number, ay: number, ah: number, al: number, aw: number, bx: number, by: number, bh: number, bl: number, bw: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const ca = Math.cos(ah);
  const sa = Math.sin(ah);
  const cb = Math.cos(bh);
  const sb = Math.sin(bh);
  // Project both boxes on each of the four axes; any gap means no contact.
  for (let k = 0; k < 4; k++) {
    const ux = k === 0 ? ca : k === 1 ? -sa : k === 2 ? cb : -sb;
    const uy = k === 0 ? sa : k === 1 ? ca : k === 2 ? sb : cb;
    const ra = al * Math.abs(ca * ux + sa * uy) + aw * Math.abs(-sa * ux + ca * uy);
    const rb = bl * Math.abs(cb * ux + sb * uy) + bw * Math.abs(-sb * ux + cb * uy);
    if (Math.abs(dx * ux + dy * uy) > ra + rb) return false;
  }
  return true;
}

/**
 * Collisions and rule breaking for one learner after it moved. Traffic
 * cannot see the learners, so a contact only counts as a crash when the
 * learner drove into the other car: it is moving and the other car is ahead
 * of its middle. A car that rolls into a learner waiting at a light simply
 * passes through, which is the trade off of a shared city.
 */
export function detectEvents(l: DrivingLearner, city: City, route: Route, world: WorldState, near: Nearby, length: number, width: number, dt: number): void {
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

  // The curb: any wheel over it means the car has left the road. The bodywork may overhang a curb in a tight turn.
  const ch = Math.cos(car.heading);
  const sh = Math.sin(car.heading);
  const fx = ch * WHEEL_X;
  const fy = sh * WHEEL_X;
  const sx = -sh * (width / 2 - 0.15);
  const sy = ch * (width / 2 - 0.15);
  l.offRoad = !isOnRoad(city, car.x + fx + sx, car.y + fy + sy) || !isOnRoad(city, car.x + fx - sx, car.y + fy - sy) || !isOnRoad(city, car.x - fx + sx, car.y - fy + sy) || !isOnRoad(city, car.x - fx - sx, car.y - fy - sy);

  l.crashed = false;
  if (car.speed > 0.5) {
    for (let n = 0; n < near.carCount; n++) {
      const i = near.cars[n];
      const dx = world.carX[i] - car.x;
      const dy = world.carY[i] - car.y;
      if (dx * dx + dy * dy > 64 || dx * ch + dy * sh < 0.3) continue;
      if (boxesOverlap(car.x, car.y, car.heading, half, width / 2, world.carX[i], world.carY[i], world.carHeading[i], world.carLength[i] / 2, world.carWidth[i] / 2)) {
        l.crashed = true;
        break;
      }
    }
  }
  l.hitPedestrian = false;
  if (car.speed > 0.3) {
    for (let n = 0; n < near.pedCount; n++) {
      const i = near.peds[n];
      const dx = world.pedX[i] - car.x;
      const dy = world.pedY[i] - car.y;
      if (dx * dx + dy * dy > 16) continue;
      const f = dx * ch + dy * sh;
      const s = -dx * sh + dy * ch;
      if (Math.abs(f) < half + PED_RADIUS && Math.abs(s) < width / 2 + PED_RADIUS) {
        l.hitPedestrian = true;
        break;
      }
    }
  }
  l.arrived = l.inDestination && car.speed < ARRIVE_SPEED && Math.abs(l.lateral) < 1.5;

  // Standing still is fine behind a red light, a car or a person; anything else is a stall.
  const s = l.sense;
  l.waiting = ((light === LIGHT_RED || light === LIGHT_YELLOW) && s.lightDistance < 30) || s.gap < 12 || s.pedDistance < 15;
  if (l.progressGain > 0) l.noProgress = 0;
  else if (!l.waiting) l.noProgress += dt;
}

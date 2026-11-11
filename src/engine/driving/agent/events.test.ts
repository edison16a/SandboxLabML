import { describe, expect, it } from 'vitest';
import { SIM_DT, SUV_SIZE } from '../car/params';
import { buildCity } from '../city/buildCity';
import { BUILT_IN_CITIES } from '../city/presets';
import { pathPoint } from '../geometry/path';
import { pickRoute } from '../route/planner';
import { buildRoute, DEST_HALF } from '../route/route';
import { Nearby } from '../sensors/nearby';
import { perceive, type RoutePose } from '../sensors/perception';
import { SIGNAL_CYCLE, LIGHT_RED, axisOf, lightState } from '../signals/plan';
import { createWorldState, type WorldState } from '../world/state';
import { detectEvents } from './events';
import { createLearner, type DrivingLearner } from './learner';
import { trackRoute } from './tracking';

const city = buildCity(BUILT_IN_CITIES[0]);
const spec = pickRoute(city, 4);
const route = buildRoute(city, spec.elements, spec.startS, spec.destS);
const near = new Nearby();

/** A learner placed at route arc length s, offset sideways, facing along the route (plus an extra turn). */
function learnerAt(s: number, lateral = 0, speed = 8, turn = 0): DrivingLearner {
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
function check(l: DrivingLearner, world: WorldState): DrivingLearner {
  trackRoute(l, city, route);
  const pose: RoutePose = { x: l.car.x, y: l.car.y, heading: l.car.heading, speed: l.car.speed, progress: l.progress, index: l.routeIndex, half: SUV_SIZE.length / 2 };
  near.gather(world, l.car.x, l.car.y);
  perceive(city, route, world, near, pose, l.sense);
  detectEvents(l, city, route, world, near, SUV_SIZE.length, SUV_SIZE.width, SIM_DT);
  return l;
}

/** An empty world with signals on at time t. */
function world(t = 0): WorldState {
  const w = createWorldState(city.signals.length);
  w.time = t;
  return w;
}

/** Puts a car in the world at route arc length s, lateral offset, facing along the route. */
function addCar(w: WorldState, s: number, lateral = 0): void {
  const p = route.path.sample(s, pathPoint());
  const i = w.carCount++;
  w.carX[i] = p.x - p.ty * lateral;
  w.carY[i] = p.y + p.tx * lateral;
  w.carHeading[i] = Math.atan2(p.ty, p.tx);
  w.carLength[i] = 4.6;
  w.carWidth[i] = 1.85;
  w.carSpeed[i] = 0;
}

const mid = route.startS + 4;

describe('collisions', () => {
  it('counts driving into a car ahead as a crash, and a car rolling into the back as none', () => {
    const ahead = world();
    addCar(ahead, mid + 4);
    expect(check(learnerAt(mid), ahead).crashed).toBe(true);
    const behind = world();
    addCar(behind, mid - 4);
    expect(check(learnerAt(mid), behind).crashed).toBe(false);
    // Standing still, even a car ahead overlapping is not the learner's doing.
    expect(check(learnerAt(mid, 0, 0), ahead).crashed).toBe(false);
  });

  it('detects hitting a person in front of the bumper', () => {
    const w = world();
    const p = route.path.sample(mid + 2.4, pathPoint());
    w.pedCount = 1;
    w.pedX[0] = p.x;
    w.pedY[0] = p.y;
    expect(check(learnerAt(mid), w).hitPedestrian).toBe(true);
    expect(check(learnerAt(mid - 6), w).hitPedestrian).toBe(false);
  });

  it('notices wheels over the curb', () => {
    expect(check(learnerAt(mid, 0), world()).offRoad).toBe(false);
    expect(check(learnerAt(mid, -2.6), world()).offRoad).toBe(true);
  });
});

describe('rules', () => {
  it('flags speeding, lane departure and wrong way', () => {
    const fast = check(learnerAt(mid, 0, route.sampleLimit[0] + 3), world());
    expect(fast.speeding).toBe(true);
    expect(fast.speedingTime).toBeCloseTo(SIM_DT);
    const drift = check(learnerAt(mid, -1.3), world());
    expect(drift.laneDeparture).toBe(true);
    expect(drift.wrongWay).toBe(false);
    const wrong = check(learnerAt(mid, 2.4), world());
    expect(wrong.wrongWay).toBe(true);
  });

  it('counts a red light run when the car enters the junction on red', () => {
    const st = route.stops[0];
    const offset = city.signalOffsets[st.signal];
    // A moment the approach is red.
    let t = 0;
    while (lightState(t, offset, st.axis) !== LIGHT_RED) t += 0.5;
    expect(t).toBeLessThan(SIGNAL_CYCLE);
    const w = world(t);
    const l = learnerAt(st.s - SUV_SIZE.length / 2 - 1, 0, 10);
    check(l, w);
    for (let k = 0; k < 12; k++) {
      const p = route.path.sample(l.progress + 0.5, pathPoint());
      l.car.x = p.x;
      l.car.y = p.y;
      check(l, w);
    }
    expect(l.redLightRuns).toBe(1);
    expect(axisOf(city.elements[route.elements[0]].dir)).toBe(st.axis);
  });

  it('arrives only when stopped in the destination zone', () => {
    expect(check(learnerAt(route.destS, 0, 0.3), world()).arrived).toBe(true);
    expect(check(learnerAt(route.destS, 0, 6), world()).arrived).toBe(false);
    expect(check(learnerAt(route.destS - DEST_HALF - 3, 0, 0), world()).arrived).toBe(false);
  });

  it('calls a car far from its route lost', () => {
    const l = learnerAt(mid);
    l.car.x += 20;
    l.routeIndex = 0;
    expect(check(l, world()).lost).toBe(true);
  });

  it('forgives standing still at a red light but not in the middle of nowhere', () => {
    const st = route.stops[0];
    let t = 0;
    while (lightState(t, city.signalOffsets[st.signal], st.axis) !== LIGHT_RED) t += 0.5;
    const waiting = check(learnerAt(st.s - SUV_SIZE.length / 2 - 2, 0, 0), world(t));
    expect(waiting.waiting).toBe(true);
    // The first tick counts the ground from the start to here as progress; the second finds none.
    const empty = world();
    const idle = check(check(learnerAt(mid, 0, 0), empty), empty);
    expect(idle.waiting).toBe(false);
    expect(idle.noProgress).toBeGreaterThan(0);
  });
});

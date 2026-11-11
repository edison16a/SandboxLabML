import { describe, expect, it } from 'vitest';
import { SIM_DT, SUV_SIZE } from '../car/params';
import { pathPoint } from '../geometry/path';
import { DEST_HALF } from '../route/route';
import { SIGNAL_CYCLE, LIGHT_RED, axisOf, lightState } from '../signals/plan';
import { check, city, learnerAt, mid, route, world } from './testBench';

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

  it('times a stand at a red light, once per stop line', () => {
    const st = route.stops[0];
    const offset = city.signalOffsets[st.signal];
    let t = 0;
    while (lightState(t, offset, st.axis) !== LIGHT_RED) t += 0.5;
    const l = learnerAt(st.s - SUV_SIZE.length / 2 - 3, 0, 0);
    for (let k = 0; k < 30; k++) check(l, world(t));
    expect(l.redWait).toBeCloseTo(30 * SIM_DT);
    // Rolling, or past the line, it stops counting and starts again for the next light.
    l.car.speed = 5;
    check(l, world(t));
    expect(l.redWait).toBeCloseTo(30 * SIM_DT);
    const past = learnerAt(st.s + 20, 0, 0);
    past.redWait = 4;
    past.waitStop = 0;
    check(past, world(t));
    expect(past.redWait).toBeLessThan(4);
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

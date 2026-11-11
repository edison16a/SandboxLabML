import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../car/params';
import { pathPoint } from '../geometry/path';
import type { ArrivalRules } from './events';
import { addCar, check, learnerAt, mid, moveCar, moveTo, route, world } from './testBench';

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

  it('never blames a crawling learner for traffic that drives through it from behind', () => {
    const w = world();
    addCar(w, mid - 7);
    const l = learnerAt(mid, 0, 1);
    for (let t = 0; t < 60; t++) {
      moveTo(l, mid + t / 30, 1);
      moveCar(w, 0, mid - 7 + (t * 10) / 30, 10);
      expect(check(l, w).crashed).toBe(false);
    }
  });

  it('never blames a waiting learner for a turning car that sweeps into its side', () => {
    const w = world();
    addCar(w, mid);
    const l = learnerAt(mid, 0, 0.6);
    for (let t = 0; t < 40; t++) {
      // The car comes in from the left at an angle, across the nose of an SUV creeping at a walking pace.
      moveCar(w, 0, mid + 2, 6, 6 - (t * 6) / 30, -2.1);
      moveTo(l, mid, 0.6);
      expect(check(l, w).crashed).toBe(false);
    }
  });

  it('keeps an overlap that began the other way harmless until it ends', () => {
    const w = world();
    addCar(w, mid - 4.5);
    const l = learnerAt(mid, 0, 0);
    check(l, w);
    // The SUV now pulls away while still touching the car that rolled into it.
    moveTo(l, mid + 0.2, 3);
    expect(check(l, w).crashed).toBe(false);
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

  it('does not blame the learner for a person who walks into its flank', () => {
    const w = world();
    const p = route.path.sample(mid - 0.9, pathPoint());
    w.pedCount = 1;
    // Beside the rear door, stepping in from the right.
    w.pedX[0] = p.x + p.ty * 1.25;
    w.pedY[0] = p.y - p.tx * 1.25;
    const l = learnerAt(mid, 0, 6);
    expect(check(l, w).hitPedestrian).toBe(false);
    moveTo(l, mid + 0.2, 6);
    expect(check(l, w).hitPedestrian).toBe(false);
  });

  it('notices wheels over the curb', () => {
    expect(check(learnerAt(mid, 0), world()).offRoad).toBe(false);
    expect(check(learnerAt(mid, -2.6), world()).offRoad).toBe(true);
  });

  it('on a lenient level only ends the drive once the center leaves the road', () => {
    const lenient: ArrivalRules = { lenientCurb: true, arriveSpeed: 8 };
    const clipped = check(learnerAt(mid, -1.4), world(), lenient);
    expect(clipped.overCurb).toBe(true);
    expect(clipped.offRoad).toBe(false);
    expect(clipped.curbTime).toBeCloseTo(SIM_DT);
    expect(check(learnerAt(mid, -4.2), world(), lenient).offRoad).toBe(true);
    // Rolling into the zone below its arrival speed counts there, but not on a level that asks for a stop.
    expect(check(learnerAt(route.destS, 0, 6), world(), lenient).arrived).toBe(true);
    expect(check(learnerAt(route.destS, 0, 6), world()).arrived).toBe(false);
  });
});

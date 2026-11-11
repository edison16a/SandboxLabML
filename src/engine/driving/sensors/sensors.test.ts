import { describe, expect, it } from 'vitest';
import { createLearner } from '../agent/learner';
import { SUV, SUV_SIZE } from '../car/params';
import { buildCity } from '../city/buildCity';
import { BUILT_IN_CITIES } from '../city/presets';
import { pathPoint } from '../geometry/path';
import { pickRoute } from '../route/planner';
import { buildRoute } from '../route/route';
import { createWorldState } from '../world/state';
import { FULL_DRIVING_INPUTS, lidarAngles, STANDARD_DRIVING_INPUTS, type DrivingInputConfig } from './inputConfig';
import { builtInInputCount, drivingInputSchema } from './inputSchema';
import { HIT_CAR, HIT_NONE, HIT_PED, Lidar } from './lidar';
import { Nearby } from './nearby';
import { writeObservation } from './observe';
import { perceive } from './perception';

const city = buildCity(BUILT_IN_CITIES[0]);
const spec = pickRoute(city, 4);
const route = buildRoute(city, spec.elements, spec.startS, spec.destS);

describe('input schema', () => {
  const configs: DrivingInputConfig[] = [STANDARD_DRIVING_INPUTS, FULL_DRIVING_INPUTS, { ...STANDARD_DRIVING_INPUTS, lane: false, light: false, pedestrian: false }, { ...FULL_DRIVING_INPUTS, lidar: { count: 1, fov: 0, range: 30 } }];
  for (const cfg of configs) {
    it(`matches the observation for ${builtInInputCount(cfg)} inputs`, () => {
      const schema = drivingInputSchema(cfg, SUV);
      expect(schema.length).toBe(builtInInputCount(cfg));
      const l = createLearner(0, route, cfg.lidar.count);
      const out = new Float64Array(schema.length);
      expect(writeObservation(l, cfg, SUV, out, null)).toBe(schema.length);
      expect(new Set(schema.map((s) => s.key)).size).toBe(schema.length);
    });
  }

  it('keys beams by angle so forks keep the beams that did not move', () => {
    const a = drivingInputSchema({ ...STANDARD_DRIVING_INPUTS, lidar: { count: 3, fov: Math.PI, range: 40 } }, SUV);
    const b = drivingInputSchema({ ...STANDARD_DRIVING_INPUTS, lidar: { count: 5, fov: Math.PI, range: 40 } }, SUV);
    expect(b.map((s) => s.key)).toEqual(expect.arrayContaining(a.filter((s) => s.group === 'ray').map((s) => s.key)));
  });
});

describe('lidar', () => {
  const p = route.path.sample(route.startS + 2, pathPoint());
  const heading = Math.atan2(p.ty, p.tx);

  it('sees a car and a person ahead, and the open street past them', () => {
    const w = createWorldState(city.signals.length);
    w.carCount = 1;
    w.carX[0] = p.x + p.tx * 20;
    w.carY[0] = p.y + p.ty * 20;
    w.carHeading[0] = heading;
    w.carLength[0] = 4.6;
    w.carWidth[0] = 1.8;
    const lidar = new Lidar([0]);
    const dist = new Float64Array(1);
    const kind = new Uint8Array(1);
    const hit = new Int32Array(1);
    const near = new Nearby().gather(w, p.x, p.y);
    lidar.cast(city, w, near, p.x, p.y, heading, 40, dist, kind, hit);
    expect(kind[0]).toBe(HIT_CAR);
    expect(hit[0]).toBe(0);
    expect(dist[0]).toBeCloseTo(20 - 2.3, 1);
    w.pedCount = 1;
    w.pedX[0] = p.x + p.tx * 8;
    w.pedY[0] = p.y + p.ty * 8;
    near.gather(w, p.x, p.y);
    lidar.cast(city, w, near, p.x, p.y, heading, 40, dist, kind, hit);
    expect(kind[0]).toBe(HIT_PED);
    expect(dist[0]).toBeCloseTo(7.7, 1);
  });

  it('reads full range down an empty lane', () => {
    const w = createWorldState(city.signals.length);
    const lidar = new Lidar(lidarAngles(1, 0));
    const dist = new Float64Array(1);
    const kind = new Uint8Array(1);
    lidar.cast(city, w, new Nearby().gather(w, p.x, p.y), p.x, p.y, heading, 10, dist, kind);
    expect(kind[0]).toBe(HIT_NONE);
    expect(dist[0]).toBe(10);
  });
});

describe('perception', () => {
  it('tracks the car ahead in the lane and ignores one in the other lane', () => {
    const l = createLearner(0, route, 0);
    const w = createWorldState(city.signals.length);
    const p = route.path.sample(route.startS + 15, pathPoint());
    w.carCount = 2;
    w.carX[0] = p.x;
    w.carY[0] = p.y;
    w.carHeading[0] = Math.atan2(p.ty, p.tx);
    w.carLength[0] = 4.6;
    w.carSpeed[0] = 5;
    w.carX[1] = p.x - p.ty * 3.5;
    w.carY[1] = p.y + p.tx * 3.5;
    w.carHeading[1] = Math.atan2(-p.ty, -p.tx);
    w.carLength[1] = 4.6;
    const pose = { x: l.car.x, y: l.car.y, heading: l.car.heading, speed: 8, progress: l.progress, index: l.routeIndex, half: SUV_SIZE.length / 2 };
    const out = perceive(city, route, w, new Nearby().gather(w, l.car.x, l.car.y), pose, l.sense);
    expect(out.car).toBe(0);
    expect(out.gap).toBeCloseTo(15 - SUV_SIZE.length / 2 - 2.3, 0);
    expect(out.relSpeed).toBeCloseTo(-3, 1);
    expect(out.light).toBeGreaterThanOrEqual(-1);
  });
});

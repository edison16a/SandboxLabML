import { describe, expect, it } from 'vitest';
import { cityFor } from './city/buildCity';
import { ELEMENT_LANE } from './city/types';
import { cityOf } from './run/settings';
import { MAX_SANDBOX_CARS, nearestLanePoint, sandboxCapacity, sandboxSetup, startCapacity } from './sandbox';
import { buildDrivingWorld, createDrivingSetup } from './setup';

const city = cityFor(cityOf('midtown'));
const trip = { city: 'midtown', level: 2, seed: 11, destination: null };

describe('Sandbox trips', () => {
  it('keeps the seeded route and moves the start up so the field fits', () => {
    const seeded = createDrivingSetup({ city: cityOf('midtown'), level: 2, seed: 11 });
    const one = sandboxSetup(trip, 1);
    expect(one.route).toEqual(seeded.route);
    const many = sandboxSetup(trip, MAX_SANDBOX_CARS);
    expect(many.route.elements).toEqual(seeded.route.elements);
    const fit = Math.min(MAX_SANDBOX_CARS, startCapacity(city, many.route));
    // The last SUV in line still starts on the first lane.
    expect(many.route.startS - 7 * (fit - 1)).toBeGreaterThanOrEqual(0);
    expect(many.route.startS).toBeLessThan(city.elements[many.route.elements[0]].path.length);
  });

  it('drives to a clicked destination', () => {
    const lane = city.elements.find((e) => e.kind === ELEMENT_LANE && e.id !== sandboxSetup(trip, 1).route.elements[0] && e.path.length > 40)!;
    const mid = lane.path.n >> 1;
    const picked = nearestLanePoint(city, lane.path.x[mid], lane.path.y[mid]);
    expect(picked?.element).toBe(lane.id);
    const setup = sandboxSetup({ ...trip, destination: picked }, 1);
    expect(setup.route.elements[setup.route.elements.length - 1]).toBe(lane.id);
    const route = buildDrivingWorld(setup).route;
    expect(route.destS).toBeGreaterThan(route.startS);
    expect(setup.maxTime).toBeGreaterThan(30);
  });

  it('lines up no more SUVs than fit before a destination on the start lane', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const start = sandboxSetup({ ...trip, seed }, 1).route;
      const destination = { element: start.elements[0], s: start.startS + 32 };
      const one = { ...trip, seed, destination };
      const cap = sandboxCapacity(one);
      const setup = sandboxSetup(one, MAX_SANDBOX_CARS);
      // Every SUV in line starts on the lane, 7 m behind the one in front, none stacked at its mouth.
      expect(setup.route.startS - 7 * (cap - 1)).toBeGreaterThanOrEqual(6 - 1e-9);
      expect(setup.route.startS).toBeLessThanOrEqual(destination.s - 30 + 1e-9);
    }
  });

  it('finds no lane far from every street', () => {
    const b = city.bounds;
    expect(nearestLanePoint(city, b.maxX + 200, b.maxY + 200)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { OUTER_WALL } from '@/engine/navigation/course/types';
import { fitDistance } from '../camera/fit';
import { BACKDROP_HALF, CITY_MARGIN, CITY_REACH } from './backdropBlocks';
import { cityEdgeFrom, farPlane, HAZE, hazeRange } from './haze';

/** Half sizes of the shortest and the longest course rooms, walls included. */
const ROOMS = [
  { hx: 15 + OUTER_WALL, hz: 7 + OUTER_WALL },
  { hx: 25 + OUTER_WALL, hz: 7 + OUTER_WALL },
];
const range = () => ({ near: 0, far: 0 });

describe('haze', () => {
  it('measures the city edge from where the camera orbits', () => {
    const { hx, hz } = ROOMS[0];
    expect(cityEdgeFrom(0, 0, hx, hz)).toBeCloseTo(hz + CITY_MARGIN + CITY_REACH);
    expect(cityEdgeFrom(0, 10, hx, hz)).toBeCloseTo(hz + CITY_MARGIN + CITY_REACH - 10);
    // A huge room runs into the square the blocks come from.
    expect(cityEdgeFrom(0, 0, 500, 500)).toBe(BACKDROP_HALF);
    expect(cityEdgeFrom(1000, 0, hx, hz)).toBe(0);
  });

  it('is full by the end of the city from every orbit target and distance', () => {
    for (const { hx, hz } of ROOMS) {
      for (const t of [{ x: 0, z: 0 }, { x: hx, z: 0 }, { x: -hx, z: hz }]) {
        const edge = cityEdgeFrom(t.x, t.z, hx, hz);
        for (const d of [0, 3, 45, 120, 330, 700]) {
          const h = hazeRange(d, edge, range());
          expect(h.far).toBeLessThanOrEqual(d + edge + 1e-9);
          expect(h.near).toBeLessThan(h.far);
          expect(h.far).toBeLessThan(farPlane(d));
        }
      }
    }
  });

  it('keeps the whole room clear from its overview', () => {
    for (const { hx, hz } of ROOMS) {
      const d = fitDistance(hx * 2 + 1.5, hz * 2 + 1.5, 42, 1.4);
      const h = hazeRange(d, cityEdgeFrom(0, 0, hx, hz), range());
      // The far corner of the room.
      expect(h.near).toBeGreaterThan(d + Math.hypot(hx, hz));
    }
  });

  it('keeps its far limits for far views', () => {
    const h = hazeRange(400, BACKDROP_HALF, range());
    expect(h.near).toBe(HAZE.near);
    expect(h.far).toBe(HAZE.far);
  });
});

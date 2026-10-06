import { describe, expect, it } from 'vitest';
import { fitDistance } from '../camera/framing';
import { arenaOrigin, ARENA_SPAN, latticeFor } from '../layout/gridLattice';
import { BACKDROP_HALF, CITY_MARGIN, CITY_REACH } from './backdropBlocks';
import { cityEdgeFrom, farPlane, HAZE, hazeRange } from './haze';

const SIZES = [1, 4, 9, 25, 50];
const range = () => ({ near: 0, far: 0 });

describe('haze', () => {
  it('measures the city edge from where the camera orbits', () => {
    const half = ARENA_SPAN / 2;
    expect(cityEdgeFrom(0, 0, half, half)).toBeCloseTo(half + CITY_MARGIN + CITY_REACH);
    expect(cityEdgeFrom(10, 0, half, half)).toBeCloseTo(half + CITY_MARGIN + CITY_REACH - 10);
    // A wide grid runs into the square the blocks come from.
    expect(cityEdgeFrom(0, 0, 500, 500)).toBe(BACKDROP_HALF);
    expect(cityEdgeFrom(1000, 0, half, half)).toBe(0);
  });

  it('is full by the end of the city from every orbit target and distance', () => {
    for (const n of SIZES) {
      for (const aspect of [0.6, 1.6]) {
        const lattice = latticeFor(n, aspect);
        const targets = [{ x: 0, z: 0 }, ...Array.from({ length: n }, (_, i) => arenaOrigin(i, lattice, { x: 0, z: 0 }))];
        for (const t of targets) {
          const edge = cityEdgeFrom(t.x, t.z, lattice.width / 2, lattice.depth / 2);
          for (const d of [0, 3, 45, 120, 330, 700]) {
            const h = hazeRange(d, edge, range());
            expect(h.far).toBeLessThanOrEqual(d + edge + 1e-9);
            expect(h.near).toBeLessThan(h.far);
            expect(h.far).toBeLessThan(farPlane(d));
          }
        }
      }
    }
  });

  it('keeps a single arena clear from its usual framing', () => {
    const d = fitDistance(ARENA_SPAN + 2, ARENA_SPAN + 2, 42, 1.4);
    const h = hazeRange(d, cityEdgeFrom(0, 0, ARENA_SPAN / 2, ARENA_SPAN / 2), range());
    // The far corner of the room seen low across the floor.
    expect(h.near).toBeGreaterThan(d + ARENA_SPAN * Math.SQRT1_2);
  });

  it('keeps its far limits for far views', () => {
    const h = hazeRange(400, BACKDROP_HALF, range());
    expect(h.near).toBe(HAZE.near);
    expect(h.far).toBe(HAZE.far);
  });
});

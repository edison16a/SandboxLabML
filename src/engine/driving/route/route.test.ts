import { describe, expect, it } from 'vitest';
import { buildCity } from '../city/buildCity';
import { BUILT_IN_CITIES } from '../city/presets';
import { ELEMENT_CONNECTOR } from '../city/types';
import { DEFAULT_ROUTE, pickRoute, shortestTree, chainTo } from './planner';
import { buildRoute } from './route';

const city = buildCity(BUILT_IN_CITIES[0]);

describe('routes', () => {
  it('picks the same trip from the same seed, and different trips from different seeds', () => {
    expect(pickRoute(city, 5)).toEqual(pickRoute(city, 5));
    const trips = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(pickRoute(city, s))));
    expect(trips.size).toBeGreaterThan(4);
  });

  it('fits the requested length and turns', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const spec = pickRoute(city, seed);
      const r = buildRoute(city, spec.elements, spec.startS, spec.destS);
      const trip = r.destS - r.startS;
      expect(trip).toBeGreaterThan(DEFAULT_ROUTE.minLength * 0.85);
      expect(trip).toBeLessThan(DEFAULT_ROUTE.maxLength * 1.15);
      expect(r.turns.filter((t) => t.turn !== 0).length).toBeGreaterThanOrEqual(DEFAULT_ROUTE.minTurns);
    }
  });

  it('joins its elements into one continuous path', () => {
    const spec = pickRoute(city, 3);
    const r = buildRoute(city, spec.elements, spec.startS, spec.destS);
    for (let i = 1; i < r.path.n; i++) expect(Math.hypot(r.path.x[i] - r.path.x[i - 1], r.path.y[i] - r.path.y[i - 1])).toBeLessThan(1.2);
    // Elements follow each other in the lane graph.
    for (let k = 1; k < r.elements.length; k++) expect(city.elements[r.elements[k - 1]].next).toContain(r.elements[k]);
    expect(r.length).toBeCloseTo(r.path.length, 6);
  });

  it('puts a stop line at the end of every lane into a signal, governed by its axis', () => {
    const spec = pickRoute(city, 8);
    const r = buildRoute(city, spec.elements, spec.startS, spec.destS);
    for (const st of r.stops) {
      expect(city.nodes[st.node].signal).toBe(st.signal);
      // The stop line is where the next connector begins.
      expect(r.turns.some((t) => Math.abs(t.s - st.s) < 1e-6)).toBe(true);
    }
    expect(r.destS).toBeGreaterThan(r.elementStart[r.elements.length - 1]);
  });

  it('finds shortest paths that prefer fewer turns', () => {
    const tree = shortestTree(city, 0);
    const chain = chainTo(tree, city.laneCount - 1);
    expect(chain).not.toBeNull();
    const turns = chain!.filter((id) => city.elements[id].kind === ELEMENT_CONNECTOR && city.elements[id].turn !== 0).length;
    expect(turns).toBeLessThanOrEqual(3);
  });
});

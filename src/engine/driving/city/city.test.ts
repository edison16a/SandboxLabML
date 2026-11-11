import { describe, expect, it } from 'vitest';
import { buildCity } from './buildCity';
import { CROSSWALK_MID, LANE_OFFSET, ROAD_HALF, SIDEWALK, STOP_LINE, WALK_LINE } from './dimensions';
import { BUILT_IN_CITIES, HELD_OUT_CITY_IDS, randomCitySpec } from './presets';
import { castStatic, isOnRoad } from './surface';
import { ELEMENT_CONNECTOR, ELEMENT_LANE } from './types';
import { everyLaneReachable, specProblems } from './validate';

const specs = [...BUILT_IN_CITIES, randomCitySpec(1), randomCitySpec(42), randomCitySpec(9001)];

describe('city generation', () => {
  for (const spec of specs) {
    it(`builds ${spec.id} with every lane reachable`, () => {
      expect(specProblems(spec)).toEqual([]);
      const city = buildCity(spec);
      expect(everyLaneReachable(city)).toBe(true);
      // Four corners are plain bends; every other node has a signal and a crossing per arm.
      expect(city.signals.length).toBe(city.nodes.length - 4);
      const arms = city.nodes.filter((n) => n.signal >= 0).reduce((a, n) => a + n.armCount, 0);
      expect(city.crosswalks.length).toBe(arms);
    });
  }

  it('is the same city from the same spec', () => {
    const a = buildCity(BUILT_IN_CITIES[0]);
    const b = buildCity(BUILT_IN_CITIES[0]);
    expect(Array.from(a.signalOffsets)).toEqual(Array.from(b.signalOffsets));
    expect(a.elements.map((e) => e.path.length)).toEqual(b.elements.map((e) => e.path.length));
  });

  it('keeps held out cities apart from the training city', () => {
    for (const id of HELD_OUT_CITY_IDS) expect(BUILT_IN_CITIES.find((c) => c.id === id)).toBeDefined();
    expect(HELD_OUT_CITY_IDS).not.toContain('midtown');
  });

  it('turns only left, straight or right, never back the way it came', () => {
    const city = buildCity(BUILT_IN_CITIES[0]);
    for (const e of city.elements) {
      if (e.kind !== ELEMENT_CONNECTOR) continue;
      expect([-1, 0, 1]).toContain(e.turn);
      const from = city.elements[e.fromLane];
      const to = city.elements[e.toLane];
      // Connectors start where their lane ends and end where the next lane starts.
      expect(Math.hypot(e.path.x[0] - from.path.x[from.path.n - 1], e.path.y[0] - from.path.y[from.path.n - 1])).toBeLessThan(1e-6);
      expect(Math.hypot(e.path.x[e.path.n - 1] - to.path.x[0], e.path.y[e.path.n - 1] - to.path.y[0])).toBeLessThan(1e-6);
    }
  });

  it('keeps the two lanes round a corner bend a lane apart', () => {
    const city = buildCity(BUILT_IN_CITIES[0]);
    for (const node of city.nodes.filter((n) => n.armCount === 2)) {
      const [a, b] = city.elements.filter((e) => e.kind === ELEMENT_CONNECTOR && e.from === node.id);
      let closest = Infinity;
      for (let i = 0; i < a.path.n; i++) for (let j = 0; j < b.path.n; j++) closest = Math.min(closest, Math.hypot(a.path.x[i] - b.path.x[j], a.path.y[i] - b.path.y[j]));
      expect(closest).toBeGreaterThan(LANE_OFFSET * 2 - 0.2);
    }
  });

  it('rejects specs the layout cannot fit', () => {
    expect(specProblems({ ...BUILT_IN_CITIES[0], columns: [30, 80] })).not.toEqual([]);
    expect(specProblems({ ...BUILT_IN_CITIES[0], rows: [80] })).not.toEqual([]);
  });
});

describe('road surface', () => {
  const city = buildCity(BUILT_IN_CITIES[0]);

  it('puts every lane and turn on the road', () => {
    for (const e of city.elements) {
      for (let i = 0; i < e.path.n; i += 3) expect(isOnRoad(city, e.path.x[i], e.path.y[i])).toBe(true);
    }
  });

  it('puts sidewalks and blocks off the road', () => {
    for (const k of city.blocks) {
      expect(isOnRoad(city, (k.x0 + k.x1) / 2, (k.y0 + k.y1) / 2)).toBe(false);
      expect(isOnRoad(city, (k.x0 + k.x1) / 2, k.y0 + SIDEWALK / 2)).toBe(false);
    }
    expect(isOnRoad(city, city.bounds.minX - 1, 0)).toBe(false);
  });

  it('casts rays to the curb at the right distance', () => {
    // From the middle of an eastbound lane mid block, looking north: the far curb is 1.75 + 3.5 m away.
    const lane = city.elements.find((e) => e.kind === ELEMENT_LANE && e.dir === 0 && e.path.length > 40)!;
    const i = Math.floor(lane.path.n / 2);
    const d = castStatic(city, lane.path.x[i], lane.path.y[i], 0, 1, 40);
    expect(d).toBeCloseTo(LANE_OFFSET + ROAD_HALF, 1);
    const near = castStatic(city, lane.path.x[i], lane.path.y[i], 0, -1, 40);
    expect(near).toBeCloseTo(ROAD_HALF - LANE_OFFSET, 1);
    // Straight ahead along the lane the ray runs to its full length.
    expect(castStatic(city, lane.path.x[i], lane.path.y[i], 1, 0, 20)).toBe(20);
  });

  it('places crossings on the arms, joining sidewalk loops', () => {
    for (const c of city.crosswalks) {
      const n = city.nodes[c.node];
      expect(Math.hypot(c.x - n.x, c.y - n.y)).toBeCloseTo(CROSSWALK_MID, 6);
      expect(Math.hypot(c.ax - c.bx, c.ay - c.by)).toBeCloseTo(2 * WALK_LINE, 6);
      expect(c.ringA).not.toBe(c.ringB);
      expect(CROSSWALK_MID).toBeLessThan(STOP_LINE);
    }
  });
});

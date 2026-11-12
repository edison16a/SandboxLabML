import { describe, expect, it } from 'vitest';
import { DIR_X, DIR_Y, LANE_OFFSET, STOP_LINE } from '@/engine/driving/city/dimensions';
import { cityFor } from '@/engine/driving/city/buildCity';
import { builtInCity, DEFAULT_CITY_ID } from '@/engine/driving/city/presets';
import { pickCornerSpot, rankCornerSpots } from './cornerSight';
import { NEAR_HEIGHT, streetscapeFor } from '../city/streetscape/layout';
import { crowdedLens, sees, sightWorld } from './sightLines';

const city = cityFor(builtInCity(DEFAULT_CITY_ID)!);
const world = sightWorld(city);

/** Every maneuver the corner camera can be asked to frame: each signalized node, each arm a car arrives on, each way out. */
function maneuvers(): Array<{ node: number; dir: number; turn: -1 | 0 | 1 }> {
  const out: Array<{ node: number; dir: number; turn: -1 | 0 | 1 }> = [];
  for (const node of city.signals) {
    const n = city.nodes[node];
    for (let arm = 0; arm < 4; arm++) {
      if (!n.arms[arm]) continue;
      // A car arriving along arm `arm` travels the opposite way.
      const dir = (arm + 2) % 4;
      for (const turn of [-1, 0, 1] as const) out.push({ node, dir, turn });
    }
  }
  return out;
}

describe('street corner camera spots', () => {
  const all = maneuvers();

  it('covers the city', () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it('never stands with a pole or signal head filling the lens', () => {
    for (const m of all) {
      const s = pickCornerSpot(city, m.node, m.dir, m.turn);
      expect(crowdedLens(world, s.x, s.y, s.height), JSON.stringify(m)).toBe(false);
    }
  });

  it('sees the stop line and the middle of the junction from the spot it picks', () => {
    for (const m of all) {
      const s = pickCornerSpot(city, m.node, m.dir, m.turn);
      const n = city.nodes[m.node];
      const fx = DIR_X[m.dir];
      const fy = DIR_Y[m.dir];
      const stopX = n.x - fx * STOP_LINE + fy * LANE_OFFSET;
      const stopY = n.y - fy * STOP_LINE - fx * LANE_OFFSET;
      expect(sees(world, s.x, s.y, s.height, stopX, stopY, 1), JSON.stringify(m)).toBe(true);
      expect(sees(world, s.x, s.y, s.height, n.x, n.y, 1), JSON.stringify(m)).toBe(true);
    }
  });

  it('keeps other spots in reserve for when the car stays hidden', () => {
    const ranked = rankCornerSpots(city, all[0].node, all[0].dir, all[0].turn);
    expect(ranked.length).toBeGreaterThan(4);
    expect(new Set(ranked.map((s) => `${s.x},${s.y},${s.height}`)).size).toBe(ranked.length);
  });
});

describe('sight lines', () => {
  it('are blocked by a building block and by a signal head at lens height', () => {
    const b = world.blocks[0];
    const midY = (b.y0 + b.y1) / 2;
    expect(sees(world, b.x0 - 3, midY, 3, b.x1 + 3, midY, 1)).toBe(false);
    const near = streetscapeFor(city).signals[0].near;
    expect(sees(world, near.x - 1.5, near.y + 0.05, NEAR_HEIGHT, near.x + 1.5, near.y - 0.05, NEAR_HEIGHT)).toBe(false);
    // The same line well above the head passes.
    expect(sees(world, near.x - 1.5, near.y + 0.05, 12, near.x + 1.5, near.y - 0.05, 12)).toBe(true);
  });
});

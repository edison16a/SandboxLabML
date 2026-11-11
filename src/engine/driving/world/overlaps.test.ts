import { describe, expect, it } from 'vitest';
import { boxesOverlap } from '../agent/contacts';
import { buildCity } from '../city/buildCity';
import { BUILT_IN_CITIES } from '../city/presets';
import { drivingLevel } from '../levels';
import { PED_RADIUS } from '../sensors/lidar';
import { CityWorld } from './cityWorld';

/**
 * Counts the moments traffic touches another car or a person over a few
 * minutes of rush hour. Each new contact counts once, however long it
 * lasts. The city's life must never look glitchy, so the answer is zero.
 */
function contacts(world: CityWorld, minutes: number): { cars: number; people: number } {
  const s = world.state;
  let cars = 0;
  let people = 0;
  let was = new Set<number>();
  let now = new Set<number>();
  for (let t = 0; t < minutes * 60 * 30; t++) {
    world.step(1 / 30);
    now.clear();
    for (let a = 0; a < s.carCount; a++) {
      const ca = Math.cos(s.carHeading[a]);
      const sa = Math.sin(s.carHeading[a]);
      for (let b = a + 1; b < s.carCount; b++) {
        const dx = s.carX[b] - s.carX[a];
        const dy = s.carY[b] - s.carY[a];
        if (dx * dx + dy * dy > 49) continue;
        if (!boxesOverlap(s.carX[a], s.carY[a], s.carHeading[a], s.carLength[a] / 2, s.carWidth[a] / 2, s.carX[b], s.carY[b], s.carHeading[b], s.carLength[b] / 2, s.carWidth[b] / 2)) continue;
        const key = a * 1000 + b;
        now.add(key);
        if (!was.has(key)) cars++;
      }
      for (let p = 0; p < s.pedCount; p++) {
        const dx = s.pedX[p] - s.carX[a];
        const dy = s.pedY[p] - s.carY[a];
        if (dx * dx + dy * dy > 16) continue;
        if (Math.abs(dx * ca + dy * sa) > s.carLength[a] / 2 + PED_RADIUS || Math.abs(-dx * sa + dy * ca) > s.carWidth[a] / 2 + PED_RADIUS) continue;
        const key = 1e6 + a * 1000 + p;
        now.add(key);
        if (!was.has(key)) people++;
      }
    }
    [was, now] = [now, was];
  }
  return { cars, people };
}

describe('traffic at rush hour', () => {
  for (const spec of BUILT_IN_CITIES) {
    it(`never drives through another car or a person in ${spec.name}`, () => {
      const world = new CityWorld(buildCity(spec), drivingLevel(5));
      world.reset(31, null);
      expect(contacts(world, 5)).toEqual({ cars: 0, people: 0 });
    });
  }
});

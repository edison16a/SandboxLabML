import { describe, expect, it } from 'vitest';
import { ADVANCE_SHARE, ADVANCE_WINDOW, advanceCurriculum, DEMOTE_REST, DEMOTE_WINDOW, startCurriculum, type Curriculum } from './curriculum';
import { cityFor } from './city/buildCity';
import { builtInCity, DEFAULT_CITY_ID } from './city/presets';
import { DRIVING_LEVELS, MAX_LEVEL } from './levels';
import { buildRoute } from './route/route';
import { createDrivingSetup } from './setup';

/** Feeds the curriculum one safe count per generation out of 100. */
function feed(c: Curriculum, safe: number[]): Curriculum {
  return safe.reduce((cur, n) => advanceCurriculum(cur, n, 100), c);
}

describe('automatic curriculum', () => {
  it('moves up on the average over several generations, not one lucky route', () => {
    const lucky = feed(startCurriculum(1), [40]);
    expect(lucky.level).toBe(1);
    const steady = feed(startCurriculum(1), Array(ADVANCE_WINDOW).fill(ADVANCE_SHARE * 100));
    expect(steady.level).toBe(2);
    expect(steady.shares).toEqual([]);
  });

  it('holds while the average stays under the bar', () => {
    const c = feed(startCurriculum(1), [20, 0, 0, 10, 0, 15, 0]);
    expect(c.level).toBe(1);
  });

  it('moves back down when a level stays out of reach, then rests before trying again', () => {
    const down = feed(startCurriculum(3), Array(DEMOTE_WINDOW).fill(0));
    expect(down.level).toBe(2);
    expect(down.rest).toBe(DEMOTE_REST);
    const resting = feed(down, Array(ADVANCE_WINDOW).fill(50));
    expect(resting.level).toBe(2);
    const back = feed(resting, Array(DEMOTE_REST - ADVANCE_WINDOW).fill(50));
    expect(back.level).toBe(3);
  });

  it('never leaves the level range', () => {
    expect(feed(startCurriculum(1), Array(DEMOTE_WINDOW * 2).fill(0)).level).toBe(1);
    expect(feed(startCurriculum(MAX_LEVEL), Array(ADVANCE_WINDOW * 2).fill(100)).level).toBe(MAX_LEVEL);
  });
});

describe('levels', () => {
  const city = cityFor(builtInCity(DEFAULT_CITY_ID)!);

  it('gives the first two levels short trips with at most one turn', () => {
    for (const level of [1, 2]) {
      for (let seed = 1; seed <= 12; seed++) {
        const setup = createDrivingSetup({ level, seed });
        const route = buildRoute(city, setup.route.elements, setup.route.startS, setup.route.destS);
        expect(route.turns.filter((t) => t.turn !== 0).length).toBeLessThanOrEqual(1);
        expect(route.destS - route.startS).toBeLessThan(DRIVING_LEVELS[0].route.maxLength + 20);
      }
    }
  });

  it('allows more time per stop line where queues form', () => {
    const quiet = createDrivingSetup({ level: 3, seed: 5 });
    const busy = createDrivingSetup({ level: 5, seed: 5 });
    expect(busy.route).toEqual(quiet.route);
    expect(busy.maxTime).toBeGreaterThan(quiet.maxTime);
  });
});

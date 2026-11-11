import { describe, expect, it } from 'vitest';
import { ADVANCE_SHARE, ADVANCE_WINDOW, advanceCurriculum, MIN_GENERATIONS, startCurriculum, withBar, type Curriculum } from './curriculum';
import { cityFor } from './city/buildCity';
import { builtInCity, DEFAULT_CITY_ID } from './city/presets';
import { DRIVING_LEVELS, MAX_LEVEL } from './levels';
import { buildRoute } from './route/route';
import { createDrivingSetup } from './setup';

/** Feeds the curriculum one safe share per generation. */
function feed(c: Curriculum, shares: number[]): Curriculum {
  return shares.reduce((cur, share) => advanceCurriculum(cur, share), c);
}

describe('automatic curriculum', () => {
  it('moves up on the average over several generations, not one lucky route', () => {
    const lucky = feed(startCurriculum(1), [1]);
    expect(lucky.level).toBe(1);
    const steady = feed(startCurriculum(1), Array(Math.max(ADVANCE_WINDOW, MIN_GENERATIONS)).fill(ADVANCE_SHARE));
    expect(steady.level).toBe(2);
    expect(steady.recent).toEqual([]);
    expect(steady.generations).toBe(0);
  });

  it('holds while the average stays under the bar', () => {
    const c = feed(startCurriculum(1), [0.9, 0, 0, 0.3, 0, 0.6, 0]);
    expect(c.level).toBe(1);
    expect(c.generations).toBe(7);
    expect(c.recent.length).toBe(ADVANCE_WINDOW);
  });

  it('never moves back down, however hard a level is', () => {
    expect(feed(startCurriculum(3), Array(200).fill(0)).level).toBe(3);
  });

  it('takes a bar from a script and keeps what it measured', () => {
    const c = feed(startCurriculum(1), [0.2, 0.2]);
    const lower = withBar(c, 0.1);
    expect(lower.bar).toBe(0.1);
    expect(lower.recent).toEqual(c.recent);
    expect(feed(lower, [0.2]).level).toBe(2);
  });

  it('never leaves the level range', () => {
    expect(startCurriculum(0).level).toBe(1);
    expect(feed(startCurriculum(MAX_LEVEL), Array(ADVANCE_WINDOW * 4).fill(1)).level).toBe(MAX_LEVEL);
  });
});

describe('levels', () => {
  const city = cityFor(builtInCity(DEFAULT_CITY_ID)!);

  it('gives every level short trips with at most one turn, rush hour included', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      for (let seed = 1; seed <= 12; seed++) {
        const setup = createDrivingSetup({ level, seed });
        const route = buildRoute(city, setup.route.elements, setup.route.startS, setup.route.destS);
        expect(route.turns.filter((t) => t.turn !== 0).length).toBeLessThanOrEqual(1);
        expect(route.destS - route.startS).toBeLessThan(DRIVING_LEVELS[0].route.maxLength + 20);
      }
    }
  });

  it('adds only crowds at rush hour, on the trips and rules of the level before', () => {
    const [traffic, rush] = [DRIVING_LEVELS[3], DRIVING_LEVELS[4]];
    expect(rush.route).toEqual(traffic.route);
    expect(rush.lenientCurb).toBe(traffic.lenientCurb);
    expect(rush.arriveSpeed).toBe(traffic.arriveSpeed);
    expect(rush.pedestrians).toBeGreaterThan(traffic.pedestrians);
    expect(rush.traffic).toBeGreaterThan(traffic.traffic);
  });

  it('allows more time per stop line where queues form', () => {
    const quiet = createDrivingSetup({ level: 3, seed: 5 });
    const busy = createDrivingSetup({ level: 4, seed: 5 });
    expect(busy.route).toEqual(quiet.route);
    expect(busy.maxTime).toBeGreaterThan(quiet.maxTime);
  });
});

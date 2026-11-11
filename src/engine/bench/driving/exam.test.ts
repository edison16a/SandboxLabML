import { describe, expect, it } from 'vitest';
import { cityFor } from '../../driving/city/buildCity';
import { HELD_OUT_CITY_IDS } from '../../driving/city/presets';
import { buildDrivingWorld } from '../../driving/setup';
import { drivingExam, EXAM_LEVELS, examSetups, parFor } from './exam';

describe('the Driving exam', () => {
  const setups = examSetups();

  it('drives two held out cities at every level past empty streets', () => {
    expect(setups).toHaveLength(HELD_OUT_CITY_IDS.length * EXAM_LEVELS.length * 2);
    expect(new Set(setups.map((c) => c.id)).size).toBe(setups.length);
    expect(new Set(setups.map((c) => c.city))).toEqual(new Set(HELD_OUT_CITY_IDS));
    expect(new Set(setups.map((c) => c.setup.level))).toEqual(new Set(EXAM_LEVELS));
  });

  it('has one turn on the turn trips and none on the straight ones', () => {
    for (const c of setups) {
      const city = cityFor(c.setup.city);
      const turns = c.setup.route.elements.filter((id) => city.elements[id].turn !== 0).length;
      expect(turns, c.id).toBe(c.id.endsWith('-turn') ? 1 : 0);
      const length = buildDrivingWorld(c.setup).route.length;
      expect(length, c.id).toBeGreaterThan(150);
    }
  });

  it('builds the same trips every time', () => {
    expect(examSetups().map((c) => c.setup)).toEqual(setups.map((c) => c.setup));
  });

  it('is drivable: the autopilot arrives safely on every trip', async () => {
    for (const c of setups) {
      const par = await parFor(c.setup);
      expect(par.arrived && par.safe, c.id).toBe(true);
      expect(par.time, c.id).toBeLessThan(c.setup.maxTime);
    }
  });

  it('shares one exam per thread', async () => {
    const a = await drivingExam();
    expect(await drivingExam()).toBe(a);
    expect(a.every((c) => c.par.time > 0 && c.par.length > 0)).toBe(true);
  });
});

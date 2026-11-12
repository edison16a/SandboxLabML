import { describe, expect, it } from 'vitest';
import { chooseDriver, LEVEL2_FLOOR } from './pick';

const driver = (generation: number, ...shares: number[]) => ({ generation, shares });

describe('the Driving model pick', () => {
  it('ships the best weighted driver among those steady at level 2', () => {
    // The first copes better with traffic but loses a newcomer's first trip too often.
    const busy = driver(150, LEVEL2_FLOOR - 0.1, 0.8, 0.8, 0.6);
    const steady = driver(140, 0.95, 0.7, 0.5, 0.2);
    const timid = driver(160, 1, 0.5, 0.1, 0);
    expect(chooseDriver([busy, steady, timid])).toBe(steady);
  });

  it('falls back to the best weighted driver when none is steady at level 2', () => {
    const a = driver(120, 0.6, 0.6, 0.5, 0.3);
    const b = driver(130, 0.7, 0.2, 0.1, 0);
    expect(chooseDriver([a, b])).toBe(a);
  });

  it('breaks a tie toward the better level 2 share, then the later generation', () => {
    expect(chooseDriver([driver(100, 0.9, 1, 1, 1), driver(110, 1, 1, 1, 1)]).generation).toBe(110);
    expect(chooseDriver([driver(100, 1, 1, 1, 1), driver(180, 1, 1, 1, 1)]).generation).toBe(180);
  });
});

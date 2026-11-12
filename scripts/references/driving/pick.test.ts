import { describe, expect, it } from 'vitest';
import { rankDrivers } from './pick';

const driver = (generation: number, ...shares: number[]) => ({ generation, shares });

describe('the Driving model pick', () => {
  it('ranks drivers by their weighted safe share over the Sandbox levels', () => {
    // Steady everywhere beats perfect at level 2 and lost in traffic.
    const steady = driver(140, 0.9, 0.8, 0.7, 0.6);
    const timid = driver(160, 1, 0.6, 0.1, 0);
    const lost = driver(150, 0.3, 0.3, 0.3, 0.3);
    expect(rankDrivers([timid, lost, steady])).toEqual([steady, timid, lost]);
  });

  it('weighs level 2 above the others', () => {
    expect(rankDrivers([driver(100, 0.5, 1, 0.5, 0.5), driver(110, 1, 0.5, 0.5, 0.5)])[0].generation).toBe(110);
  });

  it('breaks a tie toward the better level 2 share, then the later generation', () => {
    expect(rankDrivers([driver(100, 0.9, 1, 1, 1), driver(110, 1, 1, 1, 1)])[0].generation).toBe(110);
    expect(rankDrivers([driver(100, 1, 1, 1, 1), driver(180, 1, 1, 1, 1)])[0].generation).toBe(180);
  });
});

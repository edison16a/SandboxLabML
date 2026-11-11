import { describe, expect, it } from 'vitest';
import { MAX_GHOSTS, selectGhosts } from './ghostSelection';

describe('selectGhosts', () => {
  it('is log spaced in auto mode and always includes the newest', () => {
    expect(selectGhosts({ mode: 'auto' }, 15)).toEqual([0, 1, 2, 4, 7, 12, 14]);
    expect(selectGhosts({ mode: 'auto' }, 45)).toEqual([0, 1, 2, 4, 7, 12, 19, 29, 39, 44]);
  });

  it('caps the count and keeps the newest', () => {
    const gens = selectGhosts({ mode: 'every', n: 1 }, 500);
    expect(gens.length).toBeLessThanOrEqual(MAX_GHOSTS);
    expect(gens[gens.length - 1]).toBe(499);
    expect(gens[0]).toBe(0);
  });

  it('respects ranges and picks', () => {
    expect(selectGhosts({ mode: 'range', from: 3, to: 5 }, 10)).toEqual([3, 4, 5, 9]);
    expect(selectGhosts({ mode: 'pick', generations: [7, 2, 99] }, 10)).toEqual([2, 7, 9]);
  });
});

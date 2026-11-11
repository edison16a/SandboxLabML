import { describe, expect, it } from 'vitest';
import { trailingMean } from './smooth';

describe('trailingMean', () => {
  it('averages the last values and skips gaps', () => {
    expect(trailingMean([1, 3, 5, 7], 2)).toEqual([1, 2, 4, 6]);
    expect(trailingMean([null, 2, null, 4], 2)).toEqual([null, 2, 2, 4]);
    expect(trailingMean([], 5)).toEqual([]);
  });
});

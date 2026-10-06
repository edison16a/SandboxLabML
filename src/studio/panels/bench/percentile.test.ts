import { describe, expect, it } from 'vitest';
import { bandAt, percentileIn } from './percentile';

const curve = [
  { generation: 0, p25: 0, median: 5, p75: 10 },
  { generation: 100, p25: 40, median: 50, p75: 60 },
];

describe('benchmark percentile', () => {
  it('reads the band between curve points and holds it past the ends', () => {
    expect(bandAt(curve, 50)).toEqual({ p25: 20, median: 27.5, p75: 35 });
    expect(bandAt(curve, -5)).toMatchObject({ median: 5 });
    expect(bandAt(curve, 500)).toMatchObject({ median: 50 });
    expect(bandAt([], 3)).toBeNull();
  });

  it('places the median at 50 and the quartiles near 25 and 75', () => {
    const band = { p25: 40, median: 50, p75: 60 };
    expect(percentileIn(50, band)).toBe(50);
    expect(percentileIn(60, band)).toBe(75);
    expect(percentileIn(40, band)).toBe(25);
    expect(percentileIn(500, band)).toBe(99);
    expect(percentileIn(-500, band)).toBe(1);
    expect(percentileIn(51, { p25: 50, median: 50, p75: 50 })).toBe(99);
  });
});

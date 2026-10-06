import { describe, expect, it } from 'vitest';
import { BACKDROP_HALF, backdropBlocks, distanceToClear, heightRamp } from './backdropBlocks';

describe('backdrop blocks', () => {
  it('are the same every time for a seed', () => {
    expect(backdropBlocks(3)).toEqual(backdropBlocks(3));
    expect(backdropBlocks(3)).not.toEqual(backdropBlocks(4));
  });

  it('stay inside their square with sane sizes', () => {
    for (const b of backdropBlocks()) {
      expect(Math.abs(b.x)).toBeLessThan(BACKDROP_HALF);
      expect(Math.abs(b.z)).toBeLessThan(BACKDROP_HALF);
      expect(b.h).toBeGreaterThan(0);
      expect(b.w).toBeGreaterThan(1);
      expect(b.tone).toBeGreaterThanOrEqual(0);
      expect(b.tone).toBeLessThanOrEqual(1);
    }
  });

  it('measure distance from the clear area round the arenas', () => {
    expect(distanceToClear(3, -4, 10, 10)).toBe(0);
    expect(distanceToClear(13, 0, 10, 10)).toBeCloseTo(3);
    expect(distanceToClear(13, 14, 10, 10)).toBeCloseTo(5);
  });

  it('rise with distance, low by the arenas and full height far out', () => {
    expect(heightRamp(0)).toBeLessThan(0.2);
    expect(heightRamp(20)).toBeGreaterThan(heightRamp(5));
    expect(heightRamp(500)).toBe(1);
  });
});

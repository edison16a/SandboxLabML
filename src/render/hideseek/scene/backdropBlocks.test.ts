import { describe, expect, it } from 'vitest';
import { ARENA_SPAN, latticeFor } from '../layout/gridLattice';
import { BACKDROP_HALF, CITY_MARGIN, cityBase, cityBlocks, distanceToClear, heightRamp } from './backdropBlocks';

const HALF = ARENA_SPAN / 2;

describe('the block city', () => {
  it('is the same every time for the same arenas', () => {
    expect(cityBlocks(HALF, HALF, 2)).toEqual(cityBlocks(HALF, HALF, 2));
  });

  it('keeps clear of the arenas and inside its square', () => {
    for (const n of [1, 9, 50]) {
      const l = latticeFor(n, 1.6);
      for (const b of cityBlocks(l.width / 2, l.depth / 2, cityBase(n))) {
        const gap = distanceToClear(b.x, b.z, l.width / 2 + CITY_MARGIN, l.depth / 2 + CITY_MARGIN);
        expect(gap).toBeGreaterThan(Math.min(b.w, b.d) / 2 - 1e-6);
        expect(Math.abs(b.x)).toBeLessThan(BACKDROP_HALF + 40);
        expect(b.h).toBeGreaterThan(0);
        expect(b.tone).toBeGreaterThanOrEqual(0);
        expect(b.tone).toBeLessThan(1);
      }
    }
  });

  it('packs small blocks below the wall tops by the arenas and grows tall and coarse further out', () => {
    const blocks = cityBlocks(HALF, HALF, 2);
    const near = blocks.filter((b) => distanceToClear(b.x, b.z, HALF, HALF) < 4);
    const far = blocks.filter((b) => distanceToClear(b.x, b.z, HALF, HALF) > 60);
    expect(near.length).toBeGreaterThan(40);
    expect(Math.max(...near.map((b) => b.h))).toBeLessThanOrEqual(2.5);
    expect(Math.max(...near.map((b) => b.w))).toBeLessThan(2.1);
    expect(Math.max(...far.map((b) => b.h))).toBeGreaterThan(6);
    expect(Math.min(...far.map((b) => b.w))).toBeGreaterThan(3.5);
  });

  it('stays a few thousand blocks from one arena to fifty', () => {
    for (const n of [1, 4, 25, 50]) {
      const l = latticeFor(n, 1.6);
      const count = cityBlocks(l.width / 2, l.depth / 2, cityBase(n)).length;
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(6000);
    }
  });

  it('shades a block sunk among taller ones darker, and keeps the rest close in tone', () => {
    const blocks = cityBlocks(HALF, HALF, 2);
    const tones = blocks.map((b) => b.tone).sort((a, b) => a - b);
    // Most blocks share nearly one tone; only the sunk ones darken.
    expect(tones[Math.floor(tones.length * 0.5)]).toBeLessThan(0.3);
    expect(tones[tones.length - 1]).toBeGreaterThan(0.35);
  });

  it('measures distance from the clear area and rises with it', () => {
    expect(distanceToClear(3, -4, 10, 10)).toBe(0);
    expect(distanceToClear(13, 0, 10, 10)).toBeCloseTo(3);
    expect(distanceToClear(13, 14, 10, 10)).toBeCloseTo(5);
    expect(heightRamp(0)).toBeLessThan(0.25);
    expect(heightRamp(20)).toBeGreaterThan(heightRamp(5));
    expect(heightRamp(500)).toBe(1);
  });
});

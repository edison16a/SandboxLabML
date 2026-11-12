import { describe, expect, it } from 'vitest';
import { OUTER_WALL } from '@/engine/navigation/course/types';
import { BACKDROP_HALF, CITY_MARGIN, cityBlocks, distanceToClear, heightRamp } from './backdropBlocks';

/** Half sizes of the shortest course room, walls included, and the finest block size the backdrop uses. */
const HX = 15 + OUTER_WALL;
const HZ = 7 + OUTER_WALL;
const BASE = 2;

describe('the block city', () => {
  it('is the same every time for the same room', () => {
    expect(cityBlocks(HX, HZ, BASE)).toEqual(cityBlocks(HX, HZ, BASE));
  });

  it('keeps clear of the room and inside its square', () => {
    for (const hx of [HX, 25 + OUTER_WALL]) {
      for (const b of cityBlocks(hx, HZ, BASE)) {
        const gap = distanceToClear(b.x, b.z, hx + CITY_MARGIN, HZ + CITY_MARGIN);
        expect(gap).toBeGreaterThan(Math.min(b.w, b.d) / 2 - 1e-6);
        expect(Math.abs(b.x)).toBeLessThan(BACKDROP_HALF + 40);
        expect(b.h).toBeGreaterThan(0);
        expect(b.tone).toBeGreaterThanOrEqual(0);
        expect(b.tone).toBeLessThan(1);
      }
    }
  });

  it('packs small low blocks by the room and grows tall and coarse further out', () => {
    const blocks = cityBlocks(HX, HZ, BASE);
    const near = blocks.filter((b) => distanceToClear(b.x, b.z, HX, HZ) < 4);
    const far = blocks.filter((b) => distanceToClear(b.x, b.z, HX, HZ) > 60);
    expect(near.length).toBeGreaterThan(40);
    expect(Math.max(...near.map((b) => b.h))).toBeLessThanOrEqual(2.5);
    expect(Math.max(...near.map((b) => b.w))).toBeLessThan(2.1);
    expect(Math.max(...far.map((b) => b.h))).toBeGreaterThan(6);
    expect(Math.min(...far.map((b) => b.w))).toBeGreaterThan(3.5);
  });

  it('stays within the instanced capacity of the backdrop', () => {
    const count = cityBlocks(25 + OUTER_WALL, HZ, BASE).length;
    expect(count).toBeGreaterThan(800);
    expect(count).toBeLessThan(8000);
  });

  it('shades a block sunk among taller ones darker, and keeps the rest close in tone', () => {
    const tones = cityBlocks(HX, HZ, BASE)
      .map((b) => b.tone)
      .sort((a, b) => a - b);
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

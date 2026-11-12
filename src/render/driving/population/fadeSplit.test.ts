import { describe, expect, it } from 'vitest';
import { FadeSplit } from './fadeSplit';

/** SUVs in the way of the chase camera melt away and come back, never cutting in or out. */
describe('fading the population off the followed SUV', () => {
  it('eases an SUV out over a few frames instead of cutting it, then drops it', () => {
    const split = new FadeSplit(4);
    const seen: number[] = [];
    for (let k = 0; k < 60; k++) {
      split.begin(1 / 60);
      seen.push(split.place(0, 0));
    }
    expect(seen[0]).toBeGreaterThan(0.7);
    expect(seen[6]).toBeGreaterThan(0.08);
    expect(seen[6]).toBeLessThan(0.3);
    expect(seen[59]).toBe(0);
    expect(split.solidCount + split.fadeCount).toBe(0);
    // Coming back takes longer than leaving, so nothing pops in.
    split.begin(1 / 60);
    expect(split.place(0, 1)).toBeLessThan(1 - seen[0]);
  });

  it('files SUVs as solid, fading or gone, and snaps the one the detailed SUV replaces', () => {
    const split = new FadeSplit(4);
    split.begin(1 / 60);
    split.place(0, 1);
    split.place(1, 0.5);
    split.place(2, 0, true);
    expect(Array.from(split.solid.slice(0, split.solidCount))).toEqual([0]);
    expect(Array.from(split.fading.slice(0, split.fadeCount))).toEqual([1]);
    expect(split.shown[2]).toBe(0);
  });
});

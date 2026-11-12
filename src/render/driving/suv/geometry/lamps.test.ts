import { describe, expect, it } from 'vitest';
import { faceEdge, faceTop } from './cap';
import { headlampLens, LAMP, lampTop } from './front';
import { NOSE, sectionAt } from './profile';
import { BAND, tailBand } from './rear';

const steps = Array.from({ length: 101 }, (_, i) => i / 100);

describe('SUV lamps', () => {
  it('keeps every headlight lens the right way up and under the face top edge', () => {
    for (const u of steps) {
      const { lo, hi } = headlampLens(u);
      expect(hi[1]).toBeGreaterThan(lo[1] + 0.01);
      // Across the face its bezel stays clear of the hood's edge, even where that edge rounds into the side.
      if (hi[0] <= faceEdge(1, hi[1])) expect(headlampLens(u, 0.007).hi[1]).toBeLessThan(faceTop(1, hi[0]) - 0.003);
    }
  });

  it('hangs the headlight top 2 to 3 cm under the hood edge, with no flick at the corner', () => {
    const peak = sectionAt(NOSE).keys[5].z;
    for (let s = LAMP.inner + LAMP.round; s <= peak; s += 0.01) expect(lampTop(s) - faceTop(1, s)).toBeGreaterThanOrEqual(-0.03);
    for (let s = LAMP.inner + LAMP.round; s <= peak; s += 0.01) expect(lampTop(s) - faceTop(1, s)).toBeLessThanOrEqual(-0.02);
    // Round the corner the top runs level: it never climbs above where it left the face.
    for (let s = peak; s <= LAMP.outer; s += 0.01) expect(lampTop(s)).toBeLessThanOrEqual(lampTop(peak) + 0.002);
  });

  it('sizes the headlights as drawn: 9 cm tall inboard, 12 cm at the corner, wrapping round it', () => {
    const inner = headlampLens(0.12);
    const outer = headlampLens(0.88);
    expect(inner.hi[1] - inner.lo[1]).toBeGreaterThan(0.08);
    expect(outer.hi[1] - outer.lo[1]).toBeGreaterThan(0.105);
    expect(LAMP.outer - faceEdge(1, 0.85)).toBeGreaterThan(0.2);
  });

  it('keeps the tail light band the right way up and under the face top edge', () => {
    for (const u of steps) {
      const s = u * BAND.half;
      const { lo, hi } = tailBand(s);
      expect(hi).toBeGreaterThan(lo + 0.01);
      if (s <= faceEdge(-1, hi)) expect(hi).toBeLessThan(faceTop(-1, s) - 0.008);
    }
  });
});

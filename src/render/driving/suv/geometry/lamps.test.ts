import { describe, expect, it } from 'vitest';
import { faceEdge, faceTop } from './cap';
import { headlampLens, LAMP } from './front';
import { BAND, tailBand } from './rear';

const steps = Array.from({ length: 101 }, (_, i) => i / 100);

describe('SUV lamps', () => {
  it('keeps every headlight lens the right way up and under the face top edge', () => {
    for (const u of steps) {
      const { lo, hi } = headlampLens(u);
      expect(hi[1]).toBeGreaterThan(lo[1] + 0.01);
      // Across the face it hangs under the hood's edge; round the corner, under the shoulder.
      if (hi[0] <= faceEdge(1, hi[1])) expect(hi[1]).toBeLessThan(faceTop(1, hi[0]) - 0.015);
    }
  });

  it('sizes the headlights as drawn: 8 cm tall inboard, 11 cm at the corner, wrapping round it', () => {
    const inner = headlampLens(0.12);
    const outer = headlampLens(0.88);
    expect(inner.hi[1] - inner.lo[1]).toBeGreaterThan(0.07);
    expect(outer.hi[1] - outer.lo[1]).toBeGreaterThan(0.095);
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

import { describe, expect, it } from 'vitest';
import { faceEdge, faceTop } from './body';
import { headlampLens } from './front';
import { tailBand } from './rear';

const steps = Array.from({ length: 101 }, (_, i) => i / 100);

describe('SUV lamps', () => {
  it('keeps every headlight lens the right way up, under the top edge and inside the face', () => {
    for (const u of steps) {
      const { lo, hi } = headlampLens(u);
      expect(hi[1]).toBeGreaterThan(lo[1] + 0.01);
      expect(hi[1]).toBeLessThan(faceTop(1, hi[0]));
      expect(lo[0]).toBeLessThan(faceEdge(1, lo[1]) - 0.01);
    }
  });

  it('keeps the tail light band the right way up, under the top edge and inside the face', () => {
    for (const u of steps) {
      const z = u * 0.755;
      const { lo, hi } = tailBand(z);
      expect(hi).toBeGreaterThan(lo + 0.01);
      expect(hi).toBeLessThan(faceTop(-1, z));
      expect(z).toBeLessThan(faceEdge(-1, lo) - 0.01);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { spectatorGeometry } from './crowd';

describe('grandstand crowd', () => {
  it('builds a much lighter fan for Low, with the same parts', () => {
    const full = spectatorGeometry();
    const light = spectatorGeometry(true);
    const tris = (g: typeof full) => g.attributes.position.count / 3;
    expect(tris(light)).toBeLessThan(tris(full) * 0.6);
    // Every part the shader colors is still there: shirt, skin, arms and trousers.
    const parts = new Set(light.attributes.part.array);
    expect([...parts].sort()).toEqual([0, 1, 2, 3]);
  });
});

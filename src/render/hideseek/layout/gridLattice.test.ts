import { describe, expect, it } from 'vitest';
import { ARENA_GAP, ARENA_SPAN, arenaAt, arenaOrigin, gridDims, latticeFor } from './gridLattice';

describe('grid lattice', () => {
  const cases: Array<[number, [number, number], [number, number]]> = [
    [1, [1, 1], [1, 1]],
    [4, [2, 2], [2, 2]],
    [9, [3, 3], [3, 3]],
    [25, [5, 5], [5, 5]],
    [50, [10, 5], [5, 10]],
  ];
  for (const [n, wide, tall] of cases) {
    it(`lays out ${n} arenas on wide and tall viewports`, () => {
      const w = gridDims(n, 16 / 9);
      const t = gridDims(n, 9 / 16);
      expect([w.cols, w.rows]).toEqual(wide);
      expect([t.cols, t.rows]).toEqual(tall);
      expect(w.cols * w.rows).toBeGreaterThanOrEqual(n);
    });
  }

  it('keeps a 4 m gap between neighbors and centers the grid', () => {
    const l = latticeFor(50, 2);
    expect(l.pitch).toBeCloseTo(ARENA_SPAN + ARENA_GAP);
    const a = arenaOrigin(0, l, { x: 0, z: 0 });
    const b = arenaOrigin(1, l, { x: 0, z: 0 });
    const last = arenaOrigin(49, l, { x: 0, z: 0 });
    expect(b.x - a.x - ARENA_SPAN).toBeCloseTo(ARENA_GAP);
    expect(a.x + last.x).toBeCloseTo(0);
    expect(a.z + last.z).toBeCloseTo(0);
    expect(l.width).toBeCloseTo(10 * ARENA_SPAN + 9 * ARENA_GAP);
  });

  it('finds the arena under a floor point and nothing in the gaps', () => {
    const l = latticeFor(9, 1);
    for (let i = 0; i < 9; i++) {
      const o = arenaOrigin(i, l, { x: 0, z: 0 });
      expect(arenaAt(o.x + 3, o.z - 4, l)).toBe(i);
    }
    const o = arenaOrigin(0, l, { x: 0, z: 0 });
    expect(arenaAt(o.x + ARENA_SPAN / 2 + ARENA_GAP / 2, o.z, l)).toBe(-1);
    expect(arenaAt(1e4, 0, l)).toBe(-1);
  });
});

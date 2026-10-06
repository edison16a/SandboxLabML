import { describe, expect, it } from 'vitest';
import type { GenerationRecord } from '@/engine/training/records';
import { speciesShares } from './SpeciesChart';

const rec = (sizes: Record<number, number>) => ({ stats: { species: Object.entries(sizes).map(([id, size]) => ({ id: Number(id), size })) } }) as unknown as GenerationRecord;

describe('speciesShares', () => {
  it('turns sizes into shares that fill each generation', () => {
    const shares = speciesShares([rec({ 1: 30, 2: 10 }), rec({ 1: 20, 2: 20 })], [1, 2]);
    expect(Array.from(shares[0])).toEqual([0.75, 0.5]);
    expect(Array.from(shares[1])).toEqual([0.25, 0.5]);
  });

  it('smooths long histories without changing the column totals', () => {
    const records = Array.from({ length: 300 }, (_, i) => rec(i % 2 ? { 1: 9, 2: 1 } : { 1: 1, 2: 9 }));
    const shares = speciesShares(records, [1, 2]);
    expect(Math.max(...shares[0].slice(10, 290)) - Math.min(...shares[0].slice(10, 290))).toBeLessThan(0.3);
    for (let i = 0; i < 300; i++) expect(shares[0][i] + shares[1][i]).toBeCloseTo(1, 9);
  });
});

import { describe, expect, it } from 'vitest';
import { mixSeed, Rng } from './rng';
import { hashObject, stableStringify } from './hash';
import { wrapAngle } from './math';

describe('Rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('resumes exactly from a saved state', () => {
    const a = new Rng(7);
    for (let i = 0; i < 10; i++) a.next();
    const b = Rng.fromState(a.getState());
    for (let i = 0; i < 50; i++) expect(b.nextUint32()).toBe(a.nextUint32());
  });

  it('stays inside [0, 1) and looks uniform', () => {
    const r = new Rng(1);
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });

  it('produces gaussians with mean 0 and unit variance', () => {
    const r = new Rng(3);
    let sum = 0;
    let sq = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const g = r.gaussian();
      sum += g;
      sq += g * g;
    }
    expect(sum / n).toBeCloseTo(0, 1);
    expect(sq / n).toBeCloseTo(1, 1);
  });

  it('mixes seeds into distinct values', () => {
    const seen = new Set<number>();
    for (let g = 0; g < 20; g++) for (let i = 0; i < 50; i++) seen.add(mixSeed(1, g, 0, i));
    expect(seen.size).toBe(1000);
  });
});

describe('hash', () => {
  it('ignores key order', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(stableStringify({ a: [1, { c: 3, d: 2 }], b: 1 }));
    expect(hashObject({ x: 1, y: 2 })).toBe(hashObject({ y: 2, x: 1 }));
    expect(hashObject({ x: 1 })).not.toBe(hashObject({ x: 2 }));
  });
});

describe('wrapAngle', () => {
  it('maps angles into (-PI, PI]', () => {
    for (const a of [-10, -Math.PI, 0, 3, 7, 100]) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThanOrEqual(-Math.PI);
      expect(w).toBeLessThanOrEqual(Math.PI);
      expect(Math.cos(w)).toBeCloseTo(Math.cos(a), 9);
    }
  });
});

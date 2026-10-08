import { describe, expect, it } from 'vitest';
import { Trail } from './trail';

const at = () => ({ x: 0, z: 0, dx: 0, dz: 0 });

describe('Trail', () => {
  it('finds the point a given distance back along a bend', () => {
    const t = new Trail();
    for (let x = 0; x <= 10; x++) t.push(x, 0);
    for (let z = 1; z <= 10; z++) t.push(10, z);
    const out = at();
    expect(t.behind(15, out)).toBe(true);
    expect(out.x).toBeCloseTo(5);
    expect(out.z).toBeCloseTo(0);
    expect(out.dx).toBeCloseTo(1);
  });

  it('carries a short path on straight back instead of stopping at its first point', () => {
    const t = new Trail();
    // A restart on the grid: a jump starts a new path, and the car has only crept 2 m since.
    t.push(500, 500);
    t.push(0, 0);
    t.push(1, 0);
    t.push(2, 0);
    const out = at();
    expect(t.behind(12, out)).toBe(true);
    expect(out.x).toBeCloseTo(-10);
    expect(out.z).toBeCloseTo(0);
  });

  it('has no answer until the car has moved', () => {
    const t = new Trail();
    t.push(3, 4);
    expect(t.behind(10, at())).toBe(false);
  });
});

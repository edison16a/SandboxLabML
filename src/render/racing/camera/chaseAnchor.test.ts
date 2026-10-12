import { describe, expect, it } from 'vitest';
import { chaseAnchor, stepAnchor } from './chaseAnchor';

const DT = 1 / 60;

describe('the chase anchor', () => {
  it('sits on a car at a steady speed with no lag', () => {
    const a = chaseAnchor();
    let x = 0;
    for (let k = 0; k < 300; k++) stepAnchor(a, (x += 30 * DT), 0, 0, 1, DT);
    expect(Math.abs(a.x - x)).toBeLessThan(0.05);
  });

  it('filters a car that wobbles frame to frame', () => {
    const a = chaseAnchor();
    let x = 0;
    let worst = 0;
    for (let k = 0; k < 600; k++) {
      x += 30 * DT;
      // A 10 cm side to side flicker every frame, the size of a snapshot blending glitch.
      const z = k % 2 ? 0.1 : -0.1;
      stepAnchor(a, x, z, 0, 1, DT);
      if (k > 120) worst = Math.max(worst, Math.abs(a.z));
    }
    expect(worst).toBeLessThan(0.02);
  });

  it('glides onto a new car instead of jumping to it', () => {
    const a = chaseAnchor();
    for (let k = 0; k < 60; k++) stepAnchor(a, 0, 0, 0, 1, DT);
    // The lead passes to a car 4 m to the side.
    stepAnchor(a, 0, 4, 0, 2, DT);
    expect(a.z).toBeLessThan(0.5);
    let steps = 1;
    while (Math.abs(a.z - 4) > 0.05 && steps < 600) {
      stepAnchor(a, 0, 4, 0, 2, DT);
      steps++;
    }
    expect(steps * DT).toBeLessThan(1.5);
    // Critically damped: it never overshoots the new car.
    expect(a.z).toBeLessThanOrEqual(4 + 1e-6);
  });

  it('jumps straight to a car across the map, as after a restart', () => {
    const a = chaseAnchor();
    stepAnchor(a, 0, 0, 0, 1, DT);
    expect(stepAnchor(a, 500, 0, 0, 1, DT)).toBe(true);
    expect(a.x).toBe(500);
  });
});

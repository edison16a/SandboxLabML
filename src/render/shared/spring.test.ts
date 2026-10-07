import { describe, expect, it } from 'vitest';
import { springStep, stepSpring } from './interpolate';

describe('stepSpring', () => {
  it('moves exactly like springStep, in place', () => {
    const s = { value: 3, velocity: -1 };
    let value = 3;
    let velocity = -1;
    for (let i = 0; i < 40; i++) {
      [value, velocity] = springStep(value, velocity, 10, 5, 1 / 60);
      expect(stepSpring(s, 10, 5, 1 / 60)).toBe(value);
      expect(s.velocity).toBe(velocity);
    }
  });

  it('settles on its target without overshooting', () => {
    const s = { value: 0, velocity: 0 };
    let peak = 0;
    for (let i = 0; i < 600; i++) peak = Math.max(peak, stepSpring(s, 1, 4, 1 / 60));
    expect(peak).toBeLessThanOrEqual(1);
    expect(s.value).toBeCloseTo(1, 4);
  });
});

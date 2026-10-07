import { describe, expect, it } from 'vitest';
import { BoxMotion, tipOffset } from './boxMotion';

const DT = 1 / 60;

describe('BoxMotion', () => {
  it('tips a sliding box onto its leading edge, then rocks back and settles flat', () => {
    const m = new BoxMotion();
    let x = 0;
    let most = 0;
    for (let i = 0; i < 60; i++) {
      x += 1.5 * DT;
      m.update(x, 0, 0, DT);
      most = Math.max(most, m.pitch.value);
    }
    expect(most).toBeGreaterThan(0.01);
    expect(most).toBeLessThan(0.06);
    let back = 0;
    for (let i = 0; i < 30; i++) {
      m.update(x, 0, 0, DT);
      back = Math.min(back, m.pitch.value);
    }
    // Underdamped: it swings a little past flat before it settles.
    expect(back).toBeLessThan(0);
    for (let i = 0; i < 120; i++) m.update(x, 0, 0, DT);
    expect(Math.abs(m.pitch.value)).toBeLessThan(1e-3);
    expect(m.moving).toBe(false);
  });

  it('does not tip across a teleport', () => {
    const m = new BoxMotion();
    m.update(0, 0, 0, DT);
    m.update(5, 3, 0, DT);
    expect(m.pitch.value).toBe(0);
    expect(m.roll.value).toBe(0);
  });

  it('lifts the base on the far edge so the box never sinks into the floor', () => {
    const out = { x: 0, y: 0, z: 0 };
    tipOffset(0.03, -0.02, 0.5, 0.5, out);
    expect(out.y).toBeGreaterThan(0);
    tipOffset(0, 0, 0.5, 0.5, out);
    expect(out.y).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { SIM_DT, SUV } from '@/engine/driving/car/params';
import { DRIVING_SNAPSHOT, SNAP } from '@/engine/driving/snapshotLayout';
import { bodyMotion, FLAT_ROAD, stepBody } from './bodyModel';
import { damped, stepDamped } from './damped';
import { readTickMotion, tickMotion } from './tickMotion';

/** One SUV's snapshot record with the given heading, speed and steer. */
function snap(heading: number, speed: number, steer = 0): Float32Array {
  const buf = new Float32Array(DRIVING_SNAPSHOT.stride);
  buf[SNAP.heading] = heading;
  buf[SNAP.speed] = speed;
  buf[SNAP.steer] = steer;
  return buf;
}

/**
 * The followed SUV's body motion is read off the simulation and played
 * through springs. These keep it smooth and alike at any frame rate, so
 * the chase view never shakes.
 */
describe('SUV body motion', () => {
  it('settles a spring the same way at any frame rate', () => {
    const run = (fps: number) => {
      const s = damped();
      for (let t = 0; t < 0.6; t += 1 / fps) stepDamped(s, 1, 1.5, 0.4, 1 / fps);
      return s.x;
    };
    expect(Math.abs(run(30) - run(144))).toBeLessThan(0.03);
  });

  it('overshoots a little when lightly damped, like a body after a bump', () => {
    const s = damped();
    let peak = 0;
    for (let k = 0; k < 120; k++) peak = Math.max(peak, stepDamped(s, 1, 1.6, 0.4, 1 / 60));
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.4);
  });

  it('survives a long frame without blowing up', () => {
    const s = damped();
    stepDamped(s, 1, 2.1, 0.36, 2);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x)).toBeLessThan(2);
  });

  it('reads braking and a left turn from two snapshots', () => {
    const m = readTickMotion(snap(0, 12), snap(0, 12 - 6 * SIM_DT), 0, 1, SUV, tickMotion());
    expect(m.accelLong).toBeCloseTo(-6, 1);
    const turn = readTickMotion(snap(0, 10), snap(0.03, 10), 0, 1, SUV, tickMotion());
    expect(turn.accelLat).toBeGreaterThan(0);
    expect(turn.yawRate).toBeGreaterThan(0);
  });

  it('ignores the heading jump of an SUV put back at the start', () => {
    const m = readTickMotion(snap(0, 8), snap(2.5, 0), 0, 1, SUV, tickMotion());
    expect(m.yawRate).toBe(0);
    expect(m.accelLat).toBe(0);
  });

  it('dives under braking and rolls toward the outside of a bend', () => {
    const b = bodyMotion();
    const m = { ...tickMotion(), accelLong: -8, accelLat: 7, usage: 1.1 };
    for (let k = 0; k < 60; k++) stepBody(b, m, 12, FLAT_ROAD, 1 / 60);
    // Nose down is negative pitch; a left turn lowers the right side, which is positive roll.
    expect(b.pitch.x).toBeLessThan(-0.01);
    expect(b.roll.x).toBeGreaterThan(0.015);
    expect(Math.abs(b.roll.x)).toBeLessThan(0.08);
    expect(b.slip.x).toBeGreaterThan(0);
  });
});

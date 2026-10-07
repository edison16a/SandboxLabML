import { describe, expect, it } from 'vitest';
import { DEFAULT_CAR, SIM_DT } from '@/engine/racing/car/params';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { hasKerb } from '../track/kerbs';
import { bodyMotion, FLAT_ROAD, stepBody } from './bodyModel';
import { damped, stepDamped } from './damped';
import { readTickMotion, tickMotion } from './tickMotion';
import { readContact, SURFACE, wheelContact } from './wheelContact';

/** A snapshot record: x, y, heading, speed, steer, pedal, status, progress. */
const snap = (heading: number, speed: number, steer = 0) => Float32Array.from([0, 0, heading, speed, steer, 0, 0, 0]);

describe('car motion', () => {
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

  it('reads braking and a left turn from two snapshots', () => {
    const m = readTickMotion(snap(0, 30), snap(0, 30 - 13 * SIM_DT), 0, 1, DEFAULT_CAR, tickMotion());
    expect(m.accelLong).toBeCloseTo(-13, 1);
    const turn = readTickMotion(snap(0, 20), snap(0.02, 20), 0, 1, DEFAULT_CAR, tickMotion());
    expect(turn.accelLat).toBeGreaterThan(0);
    expect(turn.usage).toBeGreaterThan(0.5);
  });

  it('dives under braking and rolls toward the outside of a bend', () => {
    const b = bodyMotion();
    const m = { ...tickMotion(), accelLong: -13, accelLat: 12, usage: 1.2 };
    for (let k = 0; k < 60; k++) stepBody(b, m, 30, FLAT_ROAD, 1 / 60);
    // Nose down is negative pitch; a left turn lowers the right side, which is positive roll.
    expect(b.pitch.x).toBeLessThan(-0.01);
    expect(b.roll.x).toBeGreaterThan(0.02);
    expect(Math.abs(b.roll.x)).toBeLessThan(0.08);
    expect(b.slip.x).toBeGreaterThan(0);
  });

  it('lifts the wheels that ride over a kerb', () => {
    const track = buildTrack(BUILT_IN_TRACKS[0]);
    let i = 0;
    while (!hasKerb(track, i)) i++;
    // Put the car's center so its left wheels sit on the left kerb's crown.
    const lat = track.halfWidth + 0.45 - 0.8;
    const x = track.cx[i] - track.ty[i] * lat;
    const y = track.cy[i] + track.tx[i] * lat;
    const c = readContact(track, x, y, Math.atan2(track.ty[i], track.tx[i]), wheelContact());
    expect(c.surface[1]).toBe(SURFACE.kerb);
    expect(c.lift[1]).toBeGreaterThan(0.05);
    expect(c.surface[0]).toBe(SURFACE.asphalt);
    expect(c.road.side).toBeGreaterThan(0.02);
  });
});

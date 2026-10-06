import { describe, expect, it } from 'vitest';
import { createCar, stepCar } from './dynamics';
import { DEFAULT_CAR, GRAVITY, SIM_DT } from './params';

const p = DEFAULT_CAR;

function car(speed = 0) {
  const c = createCar(0, 0, 0);
  c.speed = speed;
  return c;
}

describe('car dynamics', () => {
  it('stops from 30 m/s within 3% of v^2 / (2 b_max)', () => {
    const c = car(30);
    while (c.speed > 0) stepCar(c, 0, -1, p);
    const expected = (30 * 30) / (2 * p.brake);
    expect(Math.abs(c.x - expected) / expected).toBeLessThan(0.03);
  });

  it('never pulls more lateral acceleration than the grip limit', () => {
    const muG = p.grip * GRAVITY;
    for (const pedal of [1, 0.5, 0, -0.5, -1]) {
      const c = car(25);
      for (let t = 0; t < 120; t++) {
        stepCar(c, 1, pedal, p);
        expect(Math.abs(c.accelLat)).toBeLessThanOrEqual(muG + 1e-6);
        if (c.speed < 1) break;
      }
    }
  });

  it('turns less under full brake than with steering alone (friction circle)', () => {
    const turnOnly = car(25);
    const turnAndBrake = car(25);
    for (let t = 0; t < 15; t++) {
      stepCar(turnOnly, 1, 0, p);
      stepCar(turnAndBrake, 1, -1, p);
    }
    expect(turnAndBrake.heading).toBeLessThan(turnOnly.heading);
  });

  it('never changes the steering angle faster than the steering rate', () => {
    const c = car(5);
    let last = c.steer;
    for (let t = 0; t < 60; t++) {
      stepCar(c, t % 20 < 10 ? 1 : -1, 0.3, p);
      expect(Math.abs(c.steer - last)).toBeLessThanOrEqual(p.steerRate * SIM_DT + 1e-9);
      last = c.steer;
    }
  });

  it('converges to a steady top speed under full throttle', () => {
    const c = car(0);
    const speeds: number[] = [];
    for (let t = 0; t < 30 * 90; t++) {
      stepCar(c, 0, 1, p);
      speeds.push(c.speed);
    }
    const end = speeds.slice(-60);
    expect(Math.max(...end) - Math.min(...end)).toBeLessThan(0.01);
    expect(c.speed).toBeGreaterThan(25);
    expect(c.speed).toBeLessThan(p.topSpeed);
  });

  it('steers less at speed than at walking pace', () => {
    const slow = car(3);
    const fast = car(30);
    for (let t = 0; t < 30; t++) {
      stepCar(slow, 1, 0, p);
      stepCar(fast, 1, 0, p);
    }
    expect(Math.abs(fast.steer)).toBeLessThan(Math.abs(slow.steer) / 3);
  });

  it('treats NaN controls as zero', () => {
    const c = car(10);
    stepCar(c, Number.NaN, Number.NaN, p);
    expect(Number.isFinite(c.x)).toBe(true);
  });
});

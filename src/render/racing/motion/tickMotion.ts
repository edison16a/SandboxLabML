import { angleDelta } from '@/engine/core/math';
import { GRAVITY, SIM_DT, type CarParams } from '@/engine/racing/car/params';

/** What a car was doing between two snapshots, read off the simulation's own numbers. */
export interface TickMotion {
  /** Along the car, m/s^2: positive speeding up, negative braking. */
  accelLong: number;
  /** Across the car, m/s^2: positive toward the left, as in a left turn. */
  accelLat: number;
  /** Share of the grip in use, 0 to 1 and a little past it when the car scrubs. */
  usage: number;
  /** Share of the steering the front tires could not deliver: understeer, 0 to 1. */
  push: number;
  /** Turning rate, rad/s, positive to the left. */
  yawRate: number;
}

export function tickMotion(): TickMotion {
  return { accelLong: 0, accelLat: 0, usage: 0, push: 0, yawRate: 0 };
}

/**
 * Works out a car's accelerations from two snapshots `ticks` simulation
 * steps apart (snapshot fields: x, y, heading, speed, steer, ...). The
 * renderer never runs physics of its own: body roll, pitch, slides and
 * smoke all follow from these, so what you see is what the car really did.
 */
export function readTickMotion(prev: Float32Array, curr: Float32Array, o: number, ticks: number, car: CarParams, out: TickMotion): TickMotion {
  const dt = Math.max(1, ticks) * SIM_DT;
  const v0 = prev[o + 3];
  const v1 = curr[o + 3];
  const yawRate = angleDelta(prev[o + 2], curr[o + 2]) / dt;
  const v = (v0 + v1) / 2;
  // A crash stops the car dead in one tick; clamp so the body rocks hard but stays on its wheels.
  out.accelLong = Math.max(-28, Math.min(16, (v1 - v0) / dt));
  // A teleported car (a new episode) can show a wild heading change; ignore it.
  out.yawRate = Math.abs(yawRate) < 4 ? yawRate : 0;
  out.accelLat = Math.max(-28, Math.min(28, v * out.yawRate));
  out.usage = Math.hypot(out.accelLong, out.accelLat) / (car.grip * GRAVITY);
  const asked = Math.tan(curr[o + 4]) / car.wheelbase;
  const got = v > 0.5 ? yawRate / v : 0;
  out.push = v > 4 && Math.abs(asked) > 0.003 ? Math.min(1, Math.max(0, 1 - got / asked)) : 0;
  return out;
}

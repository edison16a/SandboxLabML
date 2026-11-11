import type { MoverSpec, Rect } from './types';

/** A point on the floor, written in place so the hot loop allocates nothing. */
export interface Point {
  x: number;
  z: number;
}

/**
 * Where a mover's center is at `time` s. It eases in and out at both ends
 * (a cosine), so it starts, stops and turns back without a jolt, and its
 * top speed is pi * (half its travel) / period.
 */
export function moverPosition(m: MoverSpec, time: number, out: Point): Point {
  const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * (time / m.period + m.phase));
  out.x = m.ax + (m.bx - m.ax) * u;
  out.z = m.az + (m.bz - m.az) * u;
  return out;
}

/** A mover's velocity at `time`, m/s. The navigator uses it to time its crossings. */
export function moverVelocity(m: MoverSpec, time: number, out: Point): Point {
  const k = (Math.PI / m.period) * Math.sin(2 * Math.PI * (time / m.period + m.phase));
  out.x = (m.bx - m.ax) * k;
  out.z = (m.bz - m.az) * k;
  return out;
}

/** Fastest a mover ever goes, m/s. */
export function moverTopSpeed(m: MoverSpec): number {
  return (Math.PI * Math.hypot(m.bx - m.ax, m.bz - m.az)) / (2 * m.period);
}

/** The whole floor a mover sweeps over its trip. Nothing static may stand in it. */
export function moverSweep(m: MoverSpec): Rect {
  const minX = Math.min(m.ax, m.bx) - m.hx;
  const maxX = Math.max(m.ax, m.bx) + m.hx;
  const minZ = Math.min(m.az, m.bz) - m.hz;
  const maxZ = Math.max(m.az, m.bz) + m.hz;
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hx: (maxX - minX) / 2, hz: (maxZ - minZ) / 2 };
}

/**
 * The fastest a mover may go, m/s. It pushes an agent out of its way once
 * a tick, so it must move well under an agent's radius per tick, or it
 * could pass right through one.
 */
export const MOVER_SPEED_LIMIT = 2.4;

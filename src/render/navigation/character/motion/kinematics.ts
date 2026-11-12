import { angleDelta, clamp } from '@/engine/core/math';
import { approach } from './spring';

/**
 * How a character is really moving, worked out from where the simulation
 * puts it each frame: smoothed velocity, acceleration, turn rate and
 * climb rate, plus the same split along and across its facing. Positions
 * arrive as 30 Hz snapshots blended to the frame rate, so a raw difference
 * steps every snapshot; light smoothing turns that into the continuous
 * momentum the body reacts to. Nothing here feeds back into the
 * simulation.
 */
export class MotionEstimate {
  vx = 0;
  vz = 0;
  ax = 0;
  az = 0;
  yawRate = 0;
  /** Vertical speed, m/s, up positive. */
  rise = 0;
  speed = 0;
  /** Speed along the facing (negative backing up) and to the right of it, m/s. */
  forward = 0;
  lateral = 0;
  /** Acceleration along the facing and to its right, m/s². */
  forwardAccel = 0;
  lateralAccel = 0;
  private lastX = 0;
  private lastZ = 0;
  private lastYaw = 0;
  private lastElevation = 0;

  /** Forgets all motion, e.g. after a teleport, so a jump across the room is not read as a sprint. */
  reset(x: number, z: number, yaw: number, elevation: number): void {
    this.lastX = x;
    this.lastZ = z;
    this.lastYaw = yaw;
    this.lastElevation = elevation;
    this.vx = this.vz = this.ax = this.az = this.yawRate = this.rise = 0;
    this.speed = this.forward = this.lateral = this.forwardAccel = this.lateralAccel = 0;
  }

  update(x: number, z: number, yaw: number, elevation: number, dt: number): void {
    const step = clamp(dt, 1e-4, 0.1);
    const rawX = clamp((x - this.lastX) / step, -12, 12);
    const rawZ = clamp((z - this.lastZ) / step, -12, 12);
    const vx = approach(this.vx, rawX, 14, step);
    const vz = approach(this.vz, rawZ, 14, step);
    this.ax = approach(this.ax, (vx - this.vx) / step, 9, step);
    this.az = approach(this.az, (vz - this.vz) / step, 9, step);
    this.vx = vx;
    this.vz = vz;
    this.yawRate = approach(this.yawRate, clamp(angleDelta(this.lastYaw, yaw) / step, -8, 8), 12, step);
    this.rise = approach(this.rise, clamp((elevation - this.lastElevation) / step, -10, 10), 16, step);
    this.lastX = x;
    this.lastZ = z;
    this.lastYaw = yaw;
    this.lastElevation = elevation;
    // Ahead is (cos, -sin) on the floor, and the right is (sin, cos).
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    this.speed = Math.hypot(vx, vz);
    this.forward = vx * c - vz * s;
    this.lateral = vx * s + vz * c;
    this.forwardAccel = this.ax * c - this.az * s;
    this.lateralAccel = this.ax * s + this.az * c;
  }
}

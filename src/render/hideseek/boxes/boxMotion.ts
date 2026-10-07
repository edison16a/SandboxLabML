import { approach, driveSpring, spring } from '../characters/motion/spring';

/** A jump this long between frames is a teleport (a new match, a Sandbox drag), not a slide, m. */
const TELEPORT = 1.2;
/** Furthest a sliding box tips, rad: about two degrees, enough to feel its weight, never enough to look loose. */
const MAX_TIP = 0.035;

/**
 * The weight of a box, as a renderer shows it. Positions stay exactly the
 * simulation's; on top, a box that slides tips a little onto its leading
 * bottom edge, the way friction under a heavy crate trips it forward, and
 * when it stops it rocks back onto its base and settles with a small
 * bounce. Tilts are underdamped springs driven by the box's own velocity
 * and acceleration in its frame. Pure math, nothing allocated per frame.
 */
export class BoxMotion {
  /** Tip along the box's length (top toward +x positive) and across it (top toward +z positive), rad. */
  readonly pitch = spring();
  readonly roll = spring();
  private x = 0;
  private z = 0;
  private vx = 0;
  private vz = 0;
  private ax = 0;
  private az = 0;
  private fresh = true;

  update(x: number, z: number, yaw: number, dt: number): void {
    const step = Math.min(Math.max(dt, 1e-4), 0.1);
    if (this.fresh || Math.hypot(x - this.x, z - this.z) > TELEPORT) {
      this.fresh = false;
      this.x = x;
      this.z = z;
      this.vx = this.vz = this.ax = this.az = 0;
      this.pitch.value = this.pitch.velocity = this.roll.value = this.roll.velocity = 0;
      return;
    }
    const vx = approach(this.vx, (x - this.x) / step, 12, step);
    const vz = approach(this.vz, (z - this.z) / step, 12, step);
    this.ax = approach(this.ax, (vx - this.vx) / step, 8, step);
    this.az = approach(this.az, (vz - this.vz) / step, 8, step);
    this.vx = vx;
    this.vz = vz;
    this.x = x;
    this.z = z;
    // Velocity and acceleration in the box's own frame (x along its length).
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const along = vx * c - vz * s;
    const across = vx * s + vz * c;
    const accAlong = this.ax * c - this.az * s;
    const accAcross = this.ax * s + this.az * c;
    const tip = (v: number, a: number) => Math.max(-MAX_TIP, Math.min(MAX_TIP, 0.03 * Math.tanh(v / 0.6) + 0.004 * a));
    driveSpring(this.pitch, tip(along, accAlong), 16, 0.3, step);
    driveSpring(this.roll, tip(across, accAcross), 16, 0.3, step);
  }

  /** Whether the box is still rocking, so a paused canvas keeps drawing until it settles. */
  get moving(): boolean {
    return Math.abs(this.pitch.value) + Math.abs(this.roll.value) + Math.abs(this.pitch.velocity) + Math.abs(this.roll.velocity) > 1e-4;
  }
}

/**
 * Where a box's origin (the middle of its base) moves when it tips by
 * `pitch` and `roll` onto a bottom edge, for half sizes hx (length) and hz
 * (width): it pivots on the edge it tips toward, so the opposite edge lifts
 * and the box never sinks into the floor. Writes the local offset to `out`.
 */
export function tipOffset(pitch: number, roll: number, hx: number, hz: number, out: { x: number; y: number; z: number }): void {
  const px = Math.sign(pitch) * hx;
  const pz = Math.sign(roll) * hz;
  out.x = px * (1 - Math.cos(pitch));
  out.z = pz * (1 - Math.cos(roll));
  out.y = Math.abs(px * Math.sin(pitch)) + Math.abs(pz * Math.sin(roll));
}

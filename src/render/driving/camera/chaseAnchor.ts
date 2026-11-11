import { stepSpring, type Spring } from '@/render/shared/interpolate';

/**
 * How fast the anchor closes a gap to the car, 1/s, in two stages: a lead
 * point closes on the car and the anchor closes on the lead. Two stages
 * ease into a glide as well as out of it, so a hand over to another car
 * starts gently instead of with a kick. About half a second to settle.
 */
const LEAD_GRIP = 9;
const BODY_GRIP = 12;
/**
 * How fast each of the two stages of the velocity estimate follows the
 * car's real motion, 1/s. Two gentle stages in a row all but erase a one
 * frame stall or jump, which a single stage would pass on to the camera.
 */
const VELOCITY_RATE = 8;
/** How fast the smoothed heading turns after the car's, 1/s. */
const HEADING_RATE = 6;
/** A jump this far, m, is a restart on the grid or a car across the map: the anchor goes straight there. */
const SNAP = 60;
/**
 * Ground speed, m per real second, up to which the rates above hold. Faster
 * playback covers more road per second, so every rate scales up with it and
 * the anchor trails a bend by the same stretch of road at 1x or 4x.
 */
const BASE_PACE = 25;

/** A point that closes on a target on critically damped springs, its offset from the target kept as the spring. */
interface Follower {
  x: number;
  z: number;
  ex: Spring;
  ez: Spring;
}

function follower(): Follower {
  return { x: 0, z: 0, ex: { value: 0, velocity: 0 }, ez: { value: 0, velocity: 0 } };
}

/** Puts a follower on (x, z), at rest. */
function settle(f: Follower, x: number, z: number): void {
  f.x = x;
  f.z = z;
  f.ex.value = f.ex.velocity = f.ez.value = f.ez.velocity = 0;
}

/**
 * Steps a follower toward a target now at (tx, tz) moving at (vx, vz). The
 * velocity is fed forward, so a target at a steady speed is held with no
 * lag, and the springs only see what is left: a jitter or a jump.
 */
function close(f: Follower, tx: number, tz: number, vx: number, vz: number, grip: number, step: number): void {
  f.ex.value = f.x + vx * step - tx;
  f.ez.value = f.z + vz * step - tz;
  f.x = tx + stepSpring(f.ex, 0, grip, step);
  f.z = tz + stepSpring(f.ez, 0, grip, step);
}

/**
 * The point the chase camera actually follows. It is not the car: it is
 * its own body that glides after the car on springs, carried along by the
 * car's smoothed velocity so it does not trail behind at speed. A car that
 * stutters for a frame, swaps snapshots or hands the lead to another car
 * only nudges the anchor, and the camera built on it stays smooth.
 */
export interface ChaseAnchor {
  x: number;
  z: number;
  /** Smoothed heading, rad, unwrapped so it never spins the long way round. */
  heading: number;
  lead: Follower;
  body: Follower;
  /** Smoothed ground velocity of the car, m per real second, and the first stage of that smoothing. */
  vx: number;
  vz: number;
  rawX: number;
  rawZ: number;
  lastX: number;
  lastZ: number;
  /** Which car it last followed, so a switch glides instead of reading as a burst of speed. */
  owner: number;
  ready: boolean;
}

/** One number naming the followed car, stream and index together, for stepAnchor's `owner`. */
export function focusOwner(f: { focusIndex: number; focusStream: 'population' | 'ghosts' | null }): number {
  return f.focusIndex + (f.focusStream === 'ghosts' ? 100000 : 0);
}

export function chaseAnchor(): ChaseAnchor {
  return { x: 0, z: 0, heading: 0, lead: follower(), body: follower(), vx: 0, vz: 0, rawX: 0, rawZ: 0, lastX: 0, lastZ: 0, owner: -1, ready: false };
}

/** Puts the anchor right on the car, at rest relative to it. */
export function snapAnchor(a: ChaseAnchor, x: number, z: number, heading: number, owner: number): void {
  a.x = a.lastX = x;
  a.z = a.lastZ = z;
  a.heading = heading;
  settle(a.lead, x, z);
  settle(a.body, x, z);
  a.vx = a.vz = a.rawX = a.rawZ = 0;
  a.owner = owner;
  a.ready = true;
}

/**
 * Moves the anchor one frame after a car now at (x, z) facing `heading`.
 * `owner` names the car; when it changes the old velocity is kept and the
 * anchor glides across. At a steady speed the anchor sits on the car with
 * no lag, and only the jitter is filtered out. Returns true when it
 * jumped straight to the car instead (first frame, restart or far switch).
 */
export function stepAnchor(a: ChaseAnchor, x: number, z: number, heading: number, owner: number, dt: number): boolean {
  if (!a.ready || Math.hypot(x - a.x, z - a.z) > SNAP) {
    snapAnchor(a, x, z, heading, owner);
    return true;
  }
  const step = Math.max(dt, 1e-4);
  const tempo = Math.max(1, Math.hypot(a.vx, a.vz) / BASE_PACE);
  if (owner === a.owner) {
    const ease = 1 - Math.exp(-VELOCITY_RATE * tempo * step);
    a.rawX += ((x - a.lastX) / step - a.rawX) * ease;
    a.rawZ += ((z - a.lastZ) / step - a.rawZ) * ease;
    a.vx += (a.rawX - a.vx) * ease;
    a.vz += (a.rawZ - a.vz) * ease;
  }
  a.owner = owner;
  a.lastX = x;
  a.lastZ = z;
  close(a.lead, x, z, a.vx, a.vz, LEAD_GRIP * tempo, step);
  close(a.body, a.lead.x, a.lead.z, a.vx, a.vz, BODY_GRIP * tempo, step);
  a.x = a.body.x;
  a.z = a.body.z;
  const turn = Math.atan2(Math.sin(heading - a.heading), Math.cos(heading - a.heading));
  a.heading += turn * (1 - Math.exp(-HEADING_RATE * tempo * step));
  return false;
}

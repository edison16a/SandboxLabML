import { clamp, wrapAngle } from '../../core/math';
import { localAhead, localLeft, offsetX, offsetZ } from '../frame';
import type { PlayState } from '../match/state';
import { canGrab, findBoxInFront } from './reach';

/**
 * Grab logic for one agent. Runs before the physics step and after
 * `driveAgent`, because it leads the box using the velocity just commanded.
 * While the grab output is above zero an agent picks up the nearest free
 * box in front of it, then carries it at the pose it had when picked up.
 * Letting the output drop to zero or below drops the box.
 */
export function updateGrab(s: PlayState, i: number): void {
  const a = s.agents[i];
  const c = s.controls[i];
  if (a.heldBox >= 0) {
    if (!c.grab || a.frozen || !carry(s, i)) releaseBox(s, i);
    return;
  }
  // Nothing is grabbed from a slope or in the air. An agent never climbs with a box, so none is held there.
  if (!c.grab || a.frozen || a.climbing || a.airborne) return;
  const g = s.physics.grab;
  const index = findBoxInFront(s, i, g.range, g.cone, canGrab);
  if (index < 0) return;
  const b = s.boxes[index];
  c.holdAhead = localAhead(b.x - a.x, b.z - a.z, a.yaw);
  c.holdLeft = localLeft(b.x - a.x, b.z - a.z, a.yaw);
  c.holdYaw = wrapAngle(b.yaw - a.yaw);
  b.heldBy = i;
  a.heldBox = index;
  a.holding = true;
  a.justGrabbed = true;
  a.grabs++;
  s.arena.setCarried(index, true);
  carry(s, i);
}

/**
 * Velocity controller that pulls the held box toward its hold point. It
 * aims at where the hold point will be after the coming step, closes a
 * share of the gap each tick, and caps speed and spin. That keeps carrying
 * smooth and stops a box stuck on a wall from winding up a violent
 * correction. Returns false when the box is too far from its hold point
 * to keep, which drops it.
 */
function carry(s: PlayState, i: number): boolean {
  const a = s.agents[i];
  const c = s.controls[i];
  const b = s.boxes[a.heldBox];
  const g = s.physics.grab;
  const dt = s.physics.dt;
  const nowX = a.x + offsetX(c.holdAhead, c.holdLeft, a.yaw);
  const nowZ = a.z + offsetZ(c.holdAhead, c.holdLeft, a.yaw);
  if (Math.hypot(b.x - nowX, b.z - nowZ) > g.breakDistance) return false;

  const cmd = c.command;
  const yaw = a.yaw + cmd.spin * dt;
  const tx = a.x + cmd.vx * dt + offsetX(c.holdAhead, c.holdLeft, yaw);
  const tz = a.z + cmd.vz * dt + offsetZ(c.holdAhead, c.holdLeft, yaw);
  let vx = ((tx - b.x) * g.gain) / dt;
  let vz = ((tz - b.z) * g.gain) / dt;
  const speed = Math.hypot(vx, vz);
  if (speed > g.maxSpeed) {
    vx *= g.maxSpeed / speed;
    vz *= g.maxSpeed / speed;
  }
  const spin = clamp((wrapAngle(yaw + c.holdYaw - b.yaw) * g.gain) / dt, -g.maxSpin, g.maxSpin);
  s.arena.setVelocity(s.arena.boxes[a.heldBox], vx, vz, spin);
  return true;
}

/** Drops whatever agent `i` holds. The box keeps its momentum and damping brings it to rest. */
export function releaseBox(s: PlayState, i: number): void {
  const a = s.agents[i];
  if (a.heldBox < 0) return;
  s.boxes[a.heldBox].heldBy = -1;
  s.arena.setCarried(a.heldBox, false);
  a.heldBox = -1;
  a.holding = false;
  a.justReleased = true;
}

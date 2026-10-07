import { offsetX, offsetZ } from '../../frame';
import type { BoxState, PlayState } from '../../match/state';
import { rampHeightAt } from '../../physics';

/** A floor point, written into by the helpers below so they allocate nothing. */
export interface FloorPoint {
  x: number;
  z: number;
}

/**
 * The floor point `along` m uphill from the center of `ramp` and `lateral`
 * m to the left of its center line, facing uphill. The foot is at
 * along = -length / 2 and the lip at +length / 2.
 */
export function rampPoint(ramp: BoxState, along: number, lateral: number, out: FloorPoint): FloorPoint {
  out.x = ramp.x + offsetX(along, lateral, ramp.yaw);
  out.z = ramp.z + offsetZ(along, lateral, ramp.yaw);
  return out;
}

/**
 * Puts climbing agent `i` where its progress and offset say on its ramp,
 * as the ramp stands now, facing uphill at the slope height. Runs before
 * the step and again after it, so a ramp that is pushed or carried takes
 * its climber along.
 */
export function placeOnRamp(s: PlayState, i: number): void {
  const a = s.agents[i];
  const c = s.controls[i].climb;
  const ramp = s.boxes[a.climbRamp];
  rampPoint(ramp, c.progress - s.physics.box.ramp.length / 2, c.lateral, a);
  a.yaw = ramp.yaw;
  a.elevation = rampHeightAt(s.physics, c.progress);
}

/** Puts every climbing agent back on its ramp, after the physics moved the ramps. */
export function placeClimbers(s: PlayState): void {
  for (let i = 0; i < s.agents.length; i++) if (s.agents[i].climbing) placeOnRamp(s, i);
}

/**
 * Takes agent `i` off its ramp or out of the air and stands it on the
 * floor at (x, z) facing `yaw`, with its collisions back. Also used when
 * the Sandbox moves a climber by hand.
 */
export function standOnFloor(s: PlayState, i: number, x: number, z: number, yaw: number): void {
  const a = s.agents[i];
  const wasOff = a.climbing || a.airborne;
  a.x = x;
  a.z = z;
  a.yaw = yaw;
  a.climbing = false;
  a.airborne = false;
  a.climbRamp = -1;
  a.elevation = 0;
  s.arena.teleport(s.arena.agents[i], a);
  if (wasOff) s.arena.setClimbing(i, false);
}

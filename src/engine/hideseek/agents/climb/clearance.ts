import { distanceToBox, distanceToRect } from '../../layouts/geometry';
import type { PlayState } from '../../match/state';
import { boxKindSize } from '../../physics';

/** What stands on a floor spot an agent wants to land on or step off to (see spotBlocker). */
export const SPOT_CLEAR = 0;
export const SPOT_OUTSIDE = 1;
export const SPOT_WALL = 2;
export const SPOT_BOX = 3;
export const SPOT_AGENT = 4;

/**
 * Whether agent `self` would fit at (x, z): its disk inside the room and
 * clear of every wall rectangle, every box footprint (turned, ramps
 * included) and every other agent on the floor. An agent in the air
 * counts at the spot it will land on; one on a ramp counts as off the
 * floor. Returns the kind of the first blocker found, checked in that
 * order, and SPOT_CLEAR when there is none. Allocates nothing.
 */
export function spotBlocker(s: PlayState, self: number, x: number, z: number): number {
  const p = s.physics;
  const r = p.agent.radius;
  const gap = p.climb.landingGap;
  const half = p.arena.size / 2 - r;
  if (Math.abs(x) > half || Math.abs(z) > half) return SPOT_OUTSIDE;
  const walls = s.arena.walls;
  for (let w = 0; w < walls.length; w++) if (distanceToRect(x, z, walls[w]) < r + gap) return SPOT_WALL;
  for (let b = 0; b < s.boxes.length; b++) {
    const box = s.boxes[b];
    const size = boxKindSize(p, box.kind);
    if (distanceToBox(x, z, box.x, box.z, size.length / 2, size.width / 2, box.yaw) < r + gap) return SPOT_BOX;
  }
  for (let j = 0; j < s.agents.length; j++) {
    const other = s.agents[j];
    if (j === self || other.climbing) continue;
    const c = s.controls[j].climb;
    const ox = other.airborne ? c.toX : other.x;
    const oz = other.airborne ? c.toZ : other.z;
    if (Math.hypot(x - ox, z - oz) < 2 * r + gap) return SPOT_AGENT;
  }
  return SPOT_CLEAR;
}

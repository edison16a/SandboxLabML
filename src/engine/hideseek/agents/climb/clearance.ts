import { distanceToBox, distanceToRect } from '../../layouts/geometry';
import type { PlayState } from '../../match/state';
import { boxKindSize } from '../../physics';

/** What stands on a floor spot an agent wants to land on or step off to (see spotBlocker). */
export const SPOT_CLEAR = 0;
export const SPOT_OUTSIDE = 1;
export const SPOT_WALL = 2;
export const SPOT_BOX = 3;
export const SPOT_AGENT = 4;

/** The blocker spotBlocker found: its kind and its index among the walls, boxes or agents. */
export interface SpotHit {
  kind: number;
  index: number;
}

/**
 * Whether agent `self` would fit at (x, z): its disk inside the room and
 * clear of every wall rectangle, every box footprint (turned, ramps
 * included) and every other agent on the floor. An agent in the air
 * counts at the spot it will land on; one on a ramp counts as off the
 * floor. Fills `hit` with the first blocker found, checked in that order,
 * and returns its kind, SPOT_CLEAR when there is none. Allocates nothing.
 */
export function spotBlocker(s: PlayState, self: number, x: number, z: number, hit: SpotHit): number {
  const p = s.physics;
  const r = p.agent.radius;
  const gap = p.climb.landingGap;
  const half = p.arena.size / 2 - r;
  hit.index = -1;
  if (Math.abs(x) > half || Math.abs(z) > half) return (hit.kind = SPOT_OUTSIDE);
  const walls = s.arena.walls;
  for (let w = 0; w < walls.length; w++) if (distanceToRect(x, z, walls[w]) < r + gap) return found(hit, SPOT_WALL, w);
  for (let b = 0; b < s.boxes.length; b++) {
    const box = s.boxes[b];
    const size = boxKindSize(p, box.kind);
    if (distanceToBox(x, z, box.x, box.z, size.length / 2, size.width / 2, box.yaw) < r + gap) return found(hit, SPOT_BOX, b);
  }
  for (let j = 0; j < s.agents.length; j++) {
    const other = s.agents[j];
    if (j === self || other.climbing) continue;
    const c = s.controls[j].climb;
    const ox = other.airborne ? c.toX : other.x;
    const oz = other.airborne ? c.toZ : other.z;
    if (Math.hypot(x - ox, z - oz) < 2 * r + gap) return found(hit, SPOT_AGENT, j);
  }
  return (hit.kind = SPOT_CLEAR);
}

function found(hit: SpotHit, kind: number, index: number): number {
  hit.index = index;
  return (hit.kind = kind);
}

/** Height of a blocker, m. Outside the room means over the outer wall. */
export function blockerHeight(s: PlayState, hit: SpotHit): number {
  const p = s.physics;
  if (hit.kind === SPOT_BOX) return boxKindSize(p, s.boxes[hit.index].kind).height;
  if (hit.kind === SPOT_AGENT) return p.agent.height;
  return hit.kind === SPOT_CLEAR ? 0 : p.arena.wallHeight;
}

/**
 * How far along the line from (x, z) in the unit direction (dx, dz) the
 * line passes the middle of a blocker, m: halfway through a wall or box
 * footprint, or level with an agent's center. A jump puts the top of its
 * arc there.
 */
export function blockerCenter(s: PlayState, hit: SpotHit, x: number, z: number, dx: number, dz: number): number {
  if (hit.kind === SPOT_WALL) {
    const r = s.arena.walls[hit.index];
    return slabMiddle(x - r.x, z - r.z, dx, dz, r.hx, r.hz);
  }
  if (hit.kind === SPOT_BOX) {
    const b = s.boxes[hit.index];
    const size = boxKindSize(s.physics, b.kind);
    const c = Math.cos(b.yaw);
    const n = Math.sin(b.yaw);
    const rx = x - b.x;
    const rz = z - b.z;
    // Into the box frame, where the footprint is axis aligned (see distanceToBox).
    return slabMiddle(rx * c - rz * n, rx * n + rz * c, dx * c - dz * n, dx * n + dz * c, size.length / 2, size.width / 2);
  }
  if (hit.kind === SPOT_AGENT) {
    const a = s.agents[hit.index];
    return (a.x - x) * dx + (a.z - z) * dz;
  }
  return 0;
}

/** Midpoint of where a line from (rx, rz) along (dx, dz) is inside the box |x| < hx, |z| < hz, by the slab method. */
function slabMiddle(rx: number, rz: number, dx: number, dz: number, hx: number, hz: number): number {
  let lo = -Infinity;
  let hi = Infinity;
  if (dx !== 0) {
    const a = (-hx - rx) / dx;
    const b = (hx - rx) / dx;
    lo = Math.min(a, b);
    hi = Math.max(a, b);
  }
  if (dz !== 0) {
    const a = (-hz - rz) / dz;
    const b = (hz - rz) / dz;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  return Number.isFinite(lo) && Number.isFinite(hi) ? (lo + hi) / 2 : 0;
}

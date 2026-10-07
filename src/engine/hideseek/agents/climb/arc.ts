import type { PlayState } from '../../match/state';
import { boxKindSize } from '../../physics';
import type { ClimbState } from './state';

/** Where the top of the arc may sit, as a share of the jump, so neither half of the arc is a cliff. */
const PEAK_MIN = 0.1;
const PEAK_MAX = 0.9;

/**
 * The stretch of a jump line over one thing in the room, as distances
 * from the lip, m, with that thing's height. Scratch, so fitting an arc
 * allocates nothing.
 */
const over = { enter: 0, exit: 0, height: 0, wall: false };

/**
 * Fits the arc of agent `i`'s jump into `c`: from the lip at (x, z) along
 * the unit direction (dx, dz) to a landing `land` m out. Only what the
 * agent's center passes over counts: walls, boxes other than the ramp it
 * jumps off, and agents on the floor. Things it merely passes close to
 * shape where it lands, not how high it goes. The arc tops out a
 * clearance above the tallest thing it crosses, over its middle when that
 * keeps the agent above everything it crosses along the way, else moved
 * just far enough that it does.
 */
export function fitArc(s: PlayState, i: number, x: number, z: number, dx: number, dz: number, land: number, c: ClimbState): void {
  const count = s.arena.walls.length + s.boxes.length + s.agents.length;
  let tallest = 0;
  let middle = 0;
  for (let k = 0; k < count; k++) {
    if (!passOver(s, i, k, x, z, dx, dz, land)) continue;
    if (over.height > tallest) {
      tallest = over.height;
      middle = (over.enter + over.exit) / 2;
    }
  }
  c.startHeight = s.physics.box.ramp.height;
  c.peak = Math.max(c.startHeight, tallest) + s.physics.climb.clearance;
  // The arc only rises then falls, so it stays above a thing all the way over it when it is above it at both edges.
  let lo = PEAK_MIN;
  let hi = PEAK_MAX;
  for (let k = 0; k < count; k++) {
    if (!passOver(s, i, k, x, z, dx, dz, land)) continue;
    lo = Math.max(lo, earliestPeak(c, over.enter / land, over.height), earliestPeak(c, over.exit / land, over.height));
    hi = Math.min(hi, latestPeak(c, over.enter / land, over.height), latestPeak(c, over.exit / land, over.height));
  }
  // When no top suits every edge, clearing the far ones wins: a lip right against a wall cannot rise over its face in time anyway.
  c.peakAt = Math.min(PEAK_MAX, Math.max(lo, Math.min(hi, middle / land)));
}

/**
 * Earliest top that keeps the fall at or above `h` at share `t` of the
 * jump. The fall from the top is peak * (1 - v * v), v running 0 to 1.
 */
function earliestPeak(c: ClimbState, t: number, h: number): number {
  const w = Math.sqrt(1 - h / c.peak);
  return (t - w) / (1 - w);
}

/**
 * Latest top that keeps the rise at or above `h` at share `t` of the
 * jump. The rise starts at the lip height, so only things taller than it
 * set a limit.
 */
function latestPeak(c: ClimbState, t: number, h: number): number {
  if (h <= c.startHeight) return Infinity;
  const q = Math.sqrt(1 - (h - c.startHeight) / (c.peak - c.startHeight));
  return t / (1 - q);
}

/**
 * Whether the jump line, 0 to `land` m out, passes over thing `k`: the
 * walls first, then the boxes, then the agents. Fills `over` when it does.
 * The ramp the agent jumps off and agents off the floor never count.
 */
function passOver(s: PlayState, i: number, k: number, x: number, z: number, dx: number, dz: number, land: number): boolean {
  const walls = s.arena.walls;
  if (k < walls.length) {
    const r = walls[k];
    over.wall = true;
    over.height = s.physics.arena.wallHeight;
    return slab(x - r.x, z - r.z, dx, dz, r.hx, r.hz) && clip(land);
  }
  over.wall = false;
  const b = k - walls.length;
  if (b < s.boxes.length) {
    const box = s.boxes[b];
    if (b === s.agents[i].climbRamp) return false;
    const size = boxKindSize(s.physics, box.kind);
    const c = Math.cos(box.yaw);
    const n = Math.sin(box.yaw);
    const rx = x - box.x;
    const rz = z - box.z;
    over.height = size.height;
    // Into the box frame, where the footprint is axis aligned (see distanceToBox).
    return slab(rx * c - rz * n, rx * n + rz * c, dx * c - dz * n, dx * n + dz * c, size.length / 2, size.width / 2) && clip(land);
  }
  const j = b - s.boxes.length;
  const other = s.agents[j];
  if (j === i || other.climbing || other.airborne) return false;
  const r = s.physics.agent.radius;
  const along = (other.x - x) * dx + (other.z - z) * dz;
  const across = (other.x - x) * dz - (other.z - z) * dx;
  if (Math.abs(across) >= r) return false;
  const half = Math.sqrt(r * r - across * across);
  over.enter = along - half;
  over.exit = along + half;
  over.height = s.physics.agent.height;
  return clip(land);
}

/** Where the line from (rx, rz) along (dx, dz) is inside the box |x| < hx, |z| < hz, by the slab method, into `over`. */
function slab(rx: number, rz: number, dx: number, dz: number, hx: number, hz: number): boolean {
  let lo = -Infinity;
  let hi = Infinity;
  if (dx !== 0) {
    const a = (-hx - rx) / dx;
    const b = (hx - rx) / dx;
    lo = Math.min(a, b);
    hi = Math.max(a, b);
  } else if (Math.abs(rx) >= hx) return false;
  if (dz !== 0) {
    const a = (-hz - rz) / dz;
    const b = (hz - rz) / dz;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  } else if (Math.abs(rz) >= hz) return false;
  over.enter = lo;
  over.exit = hi;
  return lo < hi;
}

/** Trims `over` to the jump, 0 to `land` m out, and says whether anything is left. */
function clip(land: number): boolean {
  over.enter = Math.max(0, over.enter);
  over.exit = Math.min(land, over.exit);
  return over.enter < over.exit;
}

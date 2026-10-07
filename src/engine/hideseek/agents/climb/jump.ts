import type { PlayState } from '../../match/state';
import type { HideSeekPhysics } from '../../physics';
import { blockerCenter, blockerHeight, SPOT_CLEAR, SPOT_OUTSIDE, SPOT_WALL, spotBlocker, type SpotHit } from './clearance';
import { standOnFloor } from './ramp';
import { jumpElevation } from './state';

/** A jump's length in whole ticks, at least one. */
export function jumpTicks(p: HideSeekPhysics): number {
  return Math.max(1, Math.round(p.climb.jumpSeconds / p.dt));
}

/** Where the top of the arc may sit, as a share of the jump, so neither half of the arc is a cliff. */
const PEAK_MIN = 0.1;
const PEAK_MAX = 0.9;

/** Scratch for the blocker of each landing candidate, so planning allocates nothing. */
const hit: SpotHit = { kind: SPOT_CLEAR, index: -1 };

/**
 * Plans the jump of agent `i` off the lip at (lipX, lipZ), straight ahead
 * along `yaw` (the uphill direction). Landing spots are tried every
 * jumpStep m from just past the lip out to jumpRange m, and the first one
 * where the agent fits (see spotBlocker) wins. When a candidate before it
 * was blocked by a wall, the jump is a vault over that wall. The arc tops
 * out a clearance above the tallest thing the jump crosses, right where
 * the line passes its middle.
 * Returns false, planning nothing, when no spot in range is free, or when
 * the line runs out of the room: nobody ever jumps the outer walls.
 */
export function planJump(s: PlayState, i: number, lipX: number, lipZ: number, yaw: number): boolean {
  const p = s.physics;
  const dx = Math.cos(yaw);
  const dz = -Math.sin(yaw);
  const steps = Math.round(p.climb.jumpRange / p.climb.jumpStep);
  let vault = false;
  let tallest = 0;
  let middle = 0;
  let land = -1;
  for (let k = 1; k <= steps && land < 0; k++) {
    const d = k * p.climb.jumpStep;
    const kind = spotBlocker(s, i, lipX + dx * d, lipZ + dz * d, hit);
    if (kind === SPOT_CLEAR) land = d;
    else if (kind === SPOT_OUTSIDE) return false;
    else {
      if (kind === SPOT_WALL) vault = true;
      const h = blockerHeight(s, hit);
      if (h > tallest) {
        tallest = h;
        middle = blockerCenter(s, hit, lipX, lipZ, dx, dz);
      }
    }
  }
  if (land < 0) return false;
  const c = s.controls[i].climb;
  c.fromX = lipX;
  c.fromZ = lipZ;
  c.toX = lipX + dx * land;
  c.toZ = lipZ + dz * land;
  c.startHeight = p.box.ramp.height;
  c.peak = Math.max(c.startHeight, tallest) + p.climb.clearance;
  c.peakAt = Math.min(PEAK_MAX, Math.max(PEAK_MIN, middle / land));
  c.vault = vault;
  c.jumpTick = 0;
  c.jumpTicks = jumpTicks(p);
  return true;
}

/**
 * One tick of a jump: the agent moves in a straight line over the floor
 * from the lip to its landing spot while its elevation follows the arc.
 * On the last tick it lands with its collisions back, and a vault is
 * counted. It cannot act the whole way.
 */
export function stepJump(s: PlayState, i: number): void {
  const a = s.agents[i];
  const c = s.controls[i].climb;
  c.jumpTick++;
  const t = c.jumpTick / c.jumpTicks;
  a.speed = Math.hypot(c.toX - c.fromX, c.toZ - c.fromZ) / (c.jumpTicks * s.physics.dt);
  a.sideSpeed = 0;
  if (c.jumpTick < c.jumpTicks) {
    a.x = c.fromX + (c.toX - c.fromX) * t;
    a.z = c.fromZ + (c.toZ - c.fromZ) * t;
    a.elevation = jumpElevation(c, t);
    return;
  }
  standOnFloor(s, i, c.toX, c.toZ, a.yaw);
  a.speed = 0;
  if (c.vault) {
    a.justVaulted = true;
    a.vaults++;
  }
}

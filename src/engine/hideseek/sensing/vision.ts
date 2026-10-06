import type { Ray } from '@dimforge/rapier3d-compat';
import { NEVER_SEEN_AGE } from '../agents/agent';
import { bearing, type Pose } from '../frame';
import type { MatchState } from '../match/state';
import type { ArenaWorld } from '../world/arena';
import { SIGHT_GROUPS } from '../world/groups';

/**
 * Line of sight through Rapier ray casts, reusing one Ray for every cast.
 * Sight lines use collision groups that skip both agents, so only walls
 * and boxes block them. They run at the physics `rayHeight`, below the box
 * tops, which is what lets a box hide an agent.
 */
export class SightLines {
  private readonly arena: ArenaWorld;
  private readonly ray: Ray;

  constructor(arena: ArenaWorld) {
    this.arena = arena;
    const h = arena.physics.rayHeight;
    this.ray = new arena.rapier.Ray({ x: 0, y: h, z: 0 }, { x: 1, y: 0, z: 0 });
  }

  /** True when no wall or box lies on the straight line between two floor points. */
  clear(x0: number, z0: number, x1: number, z1: number): boolean {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return true;
    const r = this.ray;
    r.origin.x = x0;
    r.origin.z = z0;
    r.dir.x = dx / len;
    r.dir.z = dz / len;
    return !this.arena.world.castRay(r, len, true, undefined, SIGHT_GROUPS);
  }

  /**
   * Whether `viewer` sees `target`: within vision range, inside the field
   * of view centered on its facing, and a clear line to at least one of
   * three points on the target body (its center and both shoulders, the
   * body edges across the line of sight). Cheap checks run first, so most
   * calls cast no ray at all.
   */
  sees(viewer: Pose, target: Pose): boolean {
    const p = this.arena.physics;
    const dx = target.x - viewer.x;
    const dz = target.z - viewer.z;
    const d = Math.hypot(dx, dz);
    if (d > p.vision.range) return false;
    if (d < 1e-6) return true;
    if (Math.abs(bearing(dx, dz, viewer.yaw)) > p.vision.fov / 2) return false;
    if (this.clear(viewer.x, viewer.z, target.x, target.z)) return true;
    const sx = (-dz / d) * p.agent.radius;
    const sz = (dx / d) * p.agent.radius;
    return this.clear(viewer.x, viewer.z, target.x + sx, target.z + sz) || this.clear(viewer.x, viewer.z, target.x - sx, target.z - sz);
  }
}

/**
 * Updates who sees whom after a step. The seeker is blind during prep.
 * Also records the last sighting (for the opponentLastSeen input and
 * scripts) and counts seek phase ticks for the match result.
 */
export function updateVision(s: MatchState, sight: SightLines): void {
  const [hider, seeker] = s.agents;
  const prep = s.tick <= s.prepTicks;
  hider.seesOpponent = sight.sees(hider, seeker);
  seeker.seesOpponent = !prep && sight.sees(seeker, hider);
  const seen = seeker.seesOpponent;
  for (let i = 0; i < s.agents.length; i++) {
    const a = s.agents[i];
    const other = s.agents[1 - i];
    a.seen = seen;
    a.hidden = !prep && !seen;
    if (a.seesOpponent) {
      a.lastSeenAge = 0;
      a.lastSeenX = other.x;
      a.lastSeenZ = other.z;
    } else if (a.lastSeenAge < NEVER_SEEN_AGE) {
      a.lastSeenAge += s.physics.dt;
    }
  }
  if (prep) return;
  const t = s.tally;
  t.seekTicks++;
  if (!seen) t.hiddenTicks++;
  else {
    t.seenTicks++;
    if (t.firstSeenTick < 0) t.firstSeenTick = s.tick;
  }
}

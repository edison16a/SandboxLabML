import type { Collider, Ray } from '@dimforge/rapier3d-compat';
import { NEVER_SEEN_AGE, type HideSeekAgent } from '../agents/agent';
import { bearing } from '../frame';
import type { MatchState } from '../match/state';
import type { RoomWorld } from '../world/room';
import { HIGH_SIGHT_GROUPS, SIGHT_GROUPS } from '../world/groups';

/**
 * Line of sight through Rapier ray casts, reusing one Ray for every cast.
 * Sight lines use collision groups that skip both agents, so only walls
 * and boxes block them. They run at the physics `rayHeight`, below the box
 * tops, which is what lets a box hide an agent.
 *
 * Ramps change two things. When either end stands at least seeOverBoxes
 * high (on a ramp or in the air) boxes no longer block: only walls do,
 * always. And below that height the ramp an end stands on never blocks
 * its own sight lines, since the agent stands on top of it.
 */
export class SightLines {
  private readonly arena: RoomWorld;
  private readonly ray: Ray;
  /** Collider handles of ramps a line ignores, -1 for none. Read by `notSkipped`, set per line. */
  private skipA = -1;
  private skipB = -1;
  /** One closure for the life of the sight lines, so a line that skips ramps allocates nothing. */
  private readonly notSkipped = (c: Collider) => c.handle !== this.skipA && c.handle !== this.skipB;

  constructor(arena: RoomWorld) {
    this.arena = arena;
    const h = arena.physics.rayHeight;
    this.ray = new arena.rapier.Ray({ x: 0, y: h, z: 0 }, { x: 1, y: 0, z: 0 });
  }

  /**
   * True when nothing blocks the straight line between two floor points.
   * `overBoxes` lets only walls block. Boxes `skipA` and `skipB` (indexes,
   * -1 for none) do not block either.
   */
  clear(x0: number, z0: number, x1: number, z1: number, overBoxes = false, skipA = -1, skipB = -1): boolean {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return true;
    const r = this.ray;
    r.origin.x = x0;
    r.origin.z = z0;
    r.dir.x = dx / len;
    r.dir.z = dz / len;
    const world = this.arena.world;
    if (overBoxes) return !world.castRay(r, len, true, undefined, HIGH_SIGHT_GROUPS);
    if (skipA < 0 && skipB < 0) return !world.castRay(r, len, true, undefined, SIGHT_GROUPS);
    const boxes = this.arena.boxes;
    this.skipA = skipA >= 0 ? boxes[skipA].collider(0).handle : -1;
    this.skipB = skipB >= 0 ? boxes[skipB].collider(0).handle : -1;
    return !world.castRay(r, len, true, undefined, SIGHT_GROUPS, undefined, undefined, this.notSkipped);
  }

  /**
   * Whether `viewer` sees `target`: within vision range, inside the field
   * of view centered on its facing, and a clear line to at least one of
   * three points on the target body (its center and both shoulders, the
   * body edges across the line of sight). Cheap checks run first, so most
   * calls cast no ray at all.
   */
  sees(viewer: HideSeekAgent, target: HideSeekAgent): boolean {
    return this.check(viewer, target, true);
  }

  /** Like `sees`, but as if the viewer faced the target: range and a clear line only. */
  inLine(viewer: HideSeekAgent, target: HideSeekAgent): boolean {
    return this.check(viewer, target, false);
  }

  private check(viewer: HideSeekAgent, target: HideSeekAgent, facing: boolean): boolean {
    const p = this.arena.physics;
    const dx = target.x - viewer.x;
    const dz = target.z - viewer.z;
    const d = Math.hypot(dx, dz);
    if (d > p.vision.range) return false;
    if (d < 1e-6) return true;
    if (facing && Math.abs(bearing(dx, dz, viewer.yaw)) > p.vision.fov / 2) return false;
    const high = p.climb.seeOverBoxes;
    const over = viewer.elevation >= high || target.elevation >= high;
    const va = viewer.climbRamp;
    const ta = target.climbRamp;
    if (this.clear(viewer.x, viewer.z, target.x, target.z, over, va, ta)) return true;
    const sx = (-dz / d) * p.agent.radius;
    const sz = (dx / d) * p.agent.radius;
    return this.clear(viewer.x, viewer.z, target.x + sx, target.z + sz, over, va, ta) || this.clear(viewer.x, viewer.z, target.x - sx, target.z - sz, over, va, ta);
  }
}

/**
 * Updates who sees whom after a 1 v 1 step. The seeker is blind during prep.
 * Also works out whether the hider is exposed, records the last sighting (for the opponentLastSeen input and
 * scripts) and counts seek phase ticks for the match result.
 */
export function updateVision(s: MatchState, sight: SightLines): void {
  const [hider, seeker] = s.agents;
  const prep = s.tick <= s.prepTicks;
  hider.seesOpponent = sight.sees(hider, seeker);
  seeker.seesOpponent = !prep && sight.sees(seeker, hider);
  const seen = seeker.seesOpponent;
  const exposed = seen || sight.inLine(seeker, hider);
  for (let i = 0; i < s.agents.length; i++) {
    const a = s.agents[i];
    const other = s.agents[1 - i];
    a.seen = seen;
    a.hidden = !prep && !seen;
    a.exposed = exposed;
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
  if (exposed) t.exposedTicks++;
  if (!seen) t.hiddenTicks++;
  else {
    t.seenTicks++;
    if (t.firstSeenTick < 0) t.firstSeenTick = s.tick;
  }
}

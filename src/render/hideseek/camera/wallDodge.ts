import { angleDelta } from '@/engine/core/math';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { anyBlocked, clearViewOf, type RoomPoint, type ViewAngle } from './occlusion';

export type { RoomPoint } from './occlusion';

const WALL = DEFAULT_HIDESEEK_PHYSICS.arena.wallHeight;
/** Once swinging, the sight lines must pass this far over the walls before the camera stops, m, so it never stops on an edge. */
const CLEARANCE = 0.45;
/** Seconds a player stays hidden before the camera swings, so a wall it runs past does not move it. */
const PATIENCE = 0.25;
/** How fast the camera swings round to a clear side, and settles back to its usual height, 1/s. */
const SWING = 2.2;

/**
 * Keeps players in sight for a camera that orbits a point near them. When
 * a wall hides one of them for a moment, the view turns round to the
 * nearest side that sees them all (or, failing that, the first one, the
 * lead), or climbs over a corridor wall, and once clear it eases back down
 * to its usual elevation, but only where that height sees them too, so it
 * never bobs. Works in the room's own coordinates and allocates nothing.
 */
export class WallDodge {
  private blockedFor = 0;
  private swinging = false;
  private readonly goal: ViewAngle = { azimuth: 0, elevation: 0 };

  /**
   * Eases `view` for one frame of `dt` s. `eye` is the camera, `points`
   * the first `count` heads that should stay in sight (the lead first),
   * `aim` the point the camera orbits at `distance` m, and `rest` the
   * usual elevation. Returns true when it moved the view.
   */
  update(view: ViewAngle, eye: RoomPoint, points: readonly RoomPoint[], count: number, aim: RoomPoint, distance: number, rest: number, walls: readonly Rect[], dt: number): boolean {
    if (count <= 0) return false;
    const blocked = anyBlocked(points, count, eye.x, eye.y, eye.z, walls, WALL + (this.swinging ? CLEARANCE : 0));
    this.blockedFor = blocked ? this.blockedFor + dt : 0;
    const k = 1 - Math.exp(-SWING * dt);
    if (!blocked) {
      this.swinging = false;
      if (view.elevation <= rest + 1e-3) return false;
      const flat = Math.cos(rest) * distance;
      const lowX = aim.x + Math.sin(view.azimuth) * flat;
      const lowZ = aim.z + Math.cos(view.azimuth) * flat;
      if (anyBlocked(points, count, lowX, aim.y + Math.sin(rest) * distance, lowZ, walls, WALL + CLEARANCE)) return false;
      view.elevation += (rest - view.elevation) * k;
      return true;
    }
    if (this.blockedFor < PATIENCE) return false;
    const top = WALL + CLEARANCE;
    if (!clearViewOf(points, count, aim, distance, view, walls, top, this.goal) && !(count > 1 && clearViewOf(points, 1, aim, distance, view, walls, top, this.goal))) return false;
    this.swinging = true;
    view.azimuth += angleDelta(view.azimuth, this.goal.azimuth) * k;
    view.elevation += (this.goal.elevation - view.elevation) * k;
    return true;
  }

  /** Forgets any swing in progress, for a fresh shot or while you hold the orbit. */
  reset(): void {
    this.blockedFor = 0;
    this.swinging = false;
  }
}

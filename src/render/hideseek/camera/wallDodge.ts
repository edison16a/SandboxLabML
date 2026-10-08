import { angleDelta } from '@/engine/core/math';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { clearView, sightBlocked, type ViewAngle } from './occlusion';

const WALL = DEFAULT_HIDESEEK_PHYSICS.arena.wallHeight;
/** Once swinging, the sight line must pass this far over the walls before the camera stops, m, so it never stops on an edge. */
const CLEARANCE = 0.45;
/** Seconds a player stays hidden before the camera swings, so a wall it runs past does not move it. */
const PATIENCE = 0.25;
/** How fast the camera swings round to a clear side, and settles back to its usual height, 1/s. */
const SWING = 2.2;

/** A point in a room's own floor coordinates, m. */
export interface RoomPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Keeps a player in sight for a camera that orbits a point near it. When
 * a wall hides the player for a moment, the view turns round to the
 * nearest clear side, or climbs over a corridor wall, and once clear it
 * eases back down to its usual elevation, but only where that height sees
 * the player too, so it never bobs. Works in the room's own coordinates
 * and allocates nothing.
 */
export class WallDodge {
  private blockedFor = 0;
  private swinging = false;
  private readonly goal: ViewAngle = { azimuth: 0, elevation: 0 };

  /**
   * Eases `view` for one frame of `dt` s. `eye` is the camera, `player`
   * the point that must stay in sight (its head), `aim` the point the
   * camera orbits at `distance` m, and `rest` the usual elevation.
   * Returns true when it moved the view.
   */
  update(view: ViewAngle, eye: RoomPoint, player: RoomPoint, aim: RoomPoint, distance: number, rest: number, walls: readonly Rect[], dt: number): boolean {
    const blocked = sightBlocked(player.x, player.y, player.z, eye.x, eye.y, eye.z, walls, WALL + (this.swinging ? CLEARANCE : 0));
    this.blockedFor = blocked ? this.blockedFor + dt : 0;
    const k = 1 - Math.exp(-SWING * dt);
    if (!blocked) {
      this.swinging = false;
      if (view.elevation <= rest + 1e-3) return false;
      const flat = Math.cos(rest) * distance;
      const lowX = aim.x + Math.sin(view.azimuth) * flat;
      const lowZ = aim.z + Math.cos(view.azimuth) * flat;
      if (sightBlocked(player.x, player.y, player.z, lowX, aim.y + Math.sin(rest) * distance, lowZ, walls, WALL + CLEARANCE)) return false;
      view.elevation += (rest - view.elevation) * k;
      return true;
    }
    if (this.blockedFor < PATIENCE) return false;
    const reach = Math.hypot(eye.x - player.x, eye.y - player.y, eye.z - player.z);
    if (!clearView(player.x, player.y, player.z, reach, view, walls, WALL + CLEARANCE, this.goal)) return false;
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

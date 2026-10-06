import { arenaWallRects } from '../layouts/geometry';
import { layoutSetup, type MatchSetup } from '../layouts/spawn';
import type { ArenaLayout } from '../layouts/types';
import type { HideSeekPhysics } from '../physics';
import { buildArena } from './build';
import type { Rapier } from './rapier';
import { RoomWorld } from './room';

export type { PlanarVelocity } from './room';

/**
 * A pooled slot that runs one 1 v 1 room. It owns exactly one live Rapier
 * world at a time and frees it before building the next. Body access is
 * inherited from RoomWorld.
 */
export class ArenaWorld extends RoomWorld {
  readonly layout: ArenaLayout;

  constructor(R: Rapier, layout: ArenaLayout, physics: HideSeekPhysics) {
    super(R, physics, arenaWallRects(layout, physics), buildArena(R, layout, physics, layoutSetup(layout)));
    this.layout = layout;
  }

  /**
   * Starts a match: frees the current Rapier world and builds a fresh one
   * with every body at its start pose, unlocked and at rest.
   *
   * Why not move the old bodies back? Rapier keeps history beyond positions
   * and velocities. Its broad phase tree, contact graph and active body
   * order all depend on earlier matches, and they set the order the solver
   * visits contacts in, which changes float results. In tests, teleporting
   * bodies back made 4 of 40 matches drift from a fresh run, and rebuilding
   * only the moving bodies 1 of 40. Restoring a saved snapshot is exact but
   * leaks about 2 KB of WASM heap per restore. A fresh build is exact, keeps
   * the heap flat (the allocator reuses the freed blocks) and takes about a
   * tenth of a millisecond, nothing next to a 900 tick match.
   */
  reset(setup: MatchSetup): void {
    this.rebuild(() => buildArena(this.rapier, this.layout, this.physics, setup));
  }
}

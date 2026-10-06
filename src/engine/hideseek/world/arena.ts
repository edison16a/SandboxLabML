import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { quatToYaw, yawToQuat, type Pose, type Quat } from '../frame';
import { arenaWallRects } from '../layouts/geometry';
import { layoutSetup, type MatchSetup } from '../layouts/spawn';
import type { ArenaLayout, Rect } from '../layouts/types';
import type { HideSeekPhysics } from '../physics';
import { buildArena } from './build';
import type { Rapier } from './rapier';

/** Velocity of a body on the floor plane: m/s in x and z, and yaw rate in rad/s. */
export interface PlanarVelocity {
  vx: number;
  vz: number;
  spin: number;
}

/**
 * A pooled slot that runs one room. It owns exactly one live Rapier world
 * at a time and frees it before building the next, and all body access goes
 * through here using scratch objects instead of allocating.
 *
 * `world`, `agents` and `boxes` are replaced on every reset, so read them
 * through the arena each time rather than keeping them across matches.
 */
export class ArenaWorld {
  readonly layout: ArenaLayout;
  readonly physics: HideSeekPhysics;
  /** Every wall as a floor rectangle, outer walls first. Used by the sensor ray caster. */
  readonly walls: Rect[];
  /** The loaded Rapier module, for queries that need its classes. */
  readonly rapier: Rapier;
  world: World;
  /** Hider first, then seeker. */
  agents: RigidBody[];
  boxes: RigidBody[];
  private readonly vec = { x: 0, y: 0, z: 0 };
  private readonly quat: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private disposed = false;

  constructor(R: Rapier, layout: ArenaLayout, physics: HideSeekPhysics) {
    this.rapier = R;
    this.layout = layout;
    this.physics = physics;
    this.walls = arenaWallRects(layout, physics);
    const built = buildArena(R, layout, physics, layoutSetup(layout));
    this.world = built.world;
    this.agents = built.agents;
    this.boxes = built.boxes;
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
    if (this.disposed) throw new Error('This arena has been disposed.');
    this.world.free();
    const built = buildArena(this.rapier, this.layout, this.physics, setup);
    this.world = built.world;
    this.agents = built.agents;
    this.boxes = built.boxes;
  }

  step(): void {
    this.world.step();
  }

  /** Reads a body's floor pose into `out`. */
  readPose(body: RigidBody, out: Pose): void {
    const t = body.translation(this.vec);
    out.x = t.x;
    out.z = t.z;
    out.yaw = quatToYaw(body.rotation(this.quat));
  }

  readVelocity(body: RigidBody, out: PlanarVelocity): void {
    const v = body.linvel(this.vec);
    out.vx = v.x;
    out.vz = v.z;
    out.spin = body.angvel(this.vec).y;
  }

  /** Sets a body's velocity for the next step. Positive spin turns counterclockwise seen from above. */
  setVelocity(body: RigidBody, vx: number, vz: number, spin: number): void {
    const v = this.vec;
    v.x = vx;
    v.y = 0;
    v.z = vz;
    body.setLinvel(v, true);
    v.x = 0;
    v.y = spin;
    v.z = 0;
    body.setAngvel(v, true);
  }

  /** Moves a body to a pose at once and stops it. The broad phase catches up on the next step. */
  teleport(body: RigidBody, pose: Pose): void {
    const v = body.translation(this.vec);
    v.x = pose.x;
    v.z = pose.z;
    body.setTranslation(v, true);
    body.setRotation(yawToQuat(pose.yaw, this.quat), true);
    this.setVelocity(body, 0, 0, 0);
  }

  /** Locked boxes become fixed bodies: nothing can push them until they are unlocked. */
  setFixed(body: RigidBody, fixed: boolean): void {
    if (body.isFixed() === fixed) return;
    body.setBodyType(fixed ? this.rapier.RigidBodyType.Fixed : this.rapier.RigidBodyType.Dynamic, true);
    if (!fixed) this.setVelocity(body, 0, 0, 0);
  }

  /**
   * Freezes an agent in place (seekers during prep, agents a script stopped).
   * Locking every axis makes it immovable, so the hider cannot shove a
   * frozen seeker into a corner.
   */
  setFrozen(agent: number, frozen: boolean): void {
    const body = this.agents[agent];
    body.setEnabledTranslations(!frozen, false, !frozen, true);
    body.setEnabledRotations(false, !frozen, false, true);
    this.setVelocity(body, 0, 0, 0);
  }

  /** A carried box drops its damping so the hold controller is not fighting it. */
  setCarried(box: number, carried: boolean): void {
    const body = this.boxes[box];
    body.setLinearDamping(carried ? 0 : this.physics.box.linearDamping);
    body.setAngularDamping(carried ? 0 : this.physics.box.angularDamping);
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Frees the live WASM world. Safe to call twice. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
  }
}

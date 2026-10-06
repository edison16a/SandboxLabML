import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { quatToYaw, yawToQuat, type Pose, type Quat } from '../frame';
import type { MatchSetup } from '../layouts/spawn';
import { arenaWallRects } from '../layouts/geometry';
import type { ArenaLayout, Rect } from '../layouts/types';
import { boxSize, type HideSeekPhysics } from '../physics';
import { buildArena } from './build';
import type { Rapier } from './rapier';

/** Velocity of a body on the floor plane: m/s in x and z, and yaw rate in rad/s. */
export interface PlanarVelocity {
  vx: number;
  vz: number;
  spin: number;
}

/**
 * One Rapier world holding one room. It is built once and then reset for
 * every match, so thousands of matches reuse the same WASM memory. All body
 * access goes through here, using scratch objects instead of allocating.
 */
export class ArenaWorld {
  readonly layout: ArenaLayout;
  readonly physics: HideSeekPhysics;
  readonly world: World;
  /** Hider first, then seeker. */
  readonly agents: RigidBody[];
  readonly boxes: RigidBody[];
  /** Every wall as a floor rectangle, outer walls first. Used by the sensor ray caster. */
  readonly walls: Rect[];
  /** The loaded Rapier module, for queries that need its classes. */
  readonly rapier: Rapier;
  private readonly vec = { x: 0, y: 0, z: 0 };
  private readonly quat: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private disposed = false;

  constructor(R: Rapier, layout: ArenaLayout, physics: HideSeekPhysics) {
    this.rapier = R;
    this.layout = layout;
    this.physics = physics;
    this.world = new R.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = physics.dt;
    this.world.numSolverIterations = physics.solverIterations;
    const bodies = buildArena(R, this.world, layout, physics);
    this.agents = bodies.agents;
    this.boxes = bodies.boxes;
    this.walls = arenaWallRects(layout, physics);
  }

  /**
   * Puts the room back to a start state: every lock cleared, every body
   * dynamic and free to move, placed at its start pose with zero velocity.
   * Bodies are handled in creation order so the reset itself is the same
   * no matter what the previous match did.
   */
  reset(setup: MatchSetup): void {
    for (let i = 0; i < this.agents.length; i++) {
      const body = this.agents[i];
      this.setFixed(body, false);
      this.setFrozen(i, false);
      this.teleport(body, setup.agents[i]);
    }
    for (let i = 0; i < this.boxes.length; i++) {
      const body = this.boxes[i];
      this.setFixed(body, false);
      this.setCarried(i, false);
      this.teleport(body, setup.boxes[i]);
    }
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
    body.resetForces(true);
    body.resetTorques(true);
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

  /** Half length and half width of box `i`, m. */
  boxHalfExtents(i: number): [number, number] {
    const size = boxSize(this.physics, i);
    return [size.length / 2, size.width / 2];
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Frees the WASM world. Safe to call twice. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
  }
}

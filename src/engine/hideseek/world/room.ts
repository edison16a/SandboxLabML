import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { quatToYaw, yawToQuat, type Pose, type Quat } from '../frame';
import type { Rect } from '../layouts/types';
import type { HideSeekPhysics } from '../physics';
import type { ArenaBodies } from './build';
import { AGENT_GROUPS, NO_GROUPS } from './groups';
import type { Rapier } from './rapier';

/** Velocity of a body on the floor plane: m/s in x and z, and yaw rate in rad/s. */
export interface PlanarVelocity {
  vx: number;
  vz: number;
  spin: number;
}

/**
 * One live Rapier world and the bodies in it, with every body access going
 * through scratch objects instead of allocating. The 1 v 1 match uses it
 * through ArenaWorld, which adds pooling by layout, and the Sandbox uses it
 * directly for rooms the user builds. Either way the movement, grab, lock
 * and sight code sees the same world.
 *
 * `world`, `agents` and `boxes` are replaced on every rebuild, so read them
 * through the room each time rather than keeping them.
 */
export class RoomWorld {
  readonly physics: HideSeekPhysics;
  /** Every wall as a floor rectangle, outer walls first. Used by the sensor ray caster. */
  readonly walls: Rect[];
  /** The loaded Rapier module, for queries that need its classes. */
  readonly rapier: Rapier;
  world: World;
  /** In agent slot order. */
  agents: RigidBody[];
  boxes: RigidBody[];
  private readonly vec = { x: 0, y: 0, z: 0 };
  private readonly quat: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private disposed = false;

  constructor(R: Rapier, physics: HideSeekPhysics, walls: Rect[], bodies: ArenaBodies) {
    this.rapier = R;
    this.physics = physics;
    this.walls = walls;
    this.world = bodies.world;
    this.agents = bodies.agents;
    this.boxes = bodies.boxes;
  }

  /**
   * Frees the current world, then builds the next one. Freeing first lets
   * the WASM allocator hand the same blocks straight back, so the heap stays
   * flat however many rebuilds a worker does.
   */
  protected rebuild(build: () => ArenaBodies): void {
    if (this.disposed) throw new Error('This arena has been disposed.');
    this.world.free();
    const built = build();
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
   * Locking every axis makes it immovable, so a hider cannot shove a frozen
   * seeker into a corner.
   */
  setFrozen(agent: number, frozen: boolean): void {
    const body = this.agents[agent];
    body.setEnabledTranslations(!frozen, false, !frozen, true);
    body.setEnabledRotations(false, !frozen, false, true);
    this.setVelocity(body, 0, 0, 0);
  }

  /**
   * An agent on a ramp or in the air touches nothing: its collider stops
   * colliding with anything and the engine moves it instead of contacts.
   * Landing gives it its normal collisions back.
   */
  setClimbing(agent: number, climbing: boolean): void {
    const body = this.agents[agent];
    body.collider(0).setCollisionGroups(climbing ? NO_GROUPS : AGENT_GROUPS);
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

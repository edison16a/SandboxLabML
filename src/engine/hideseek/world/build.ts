import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { yawToQuat, type Pose } from '../frame';
import { arenaWallRects } from '../layouts/geometry';
import type { MatchSetup } from '../layouts/spawn';
import type { ArenaLayout, Rect } from '../layouts/types';
import { BOX_KINDS, boxKindSize, type BoxKind, type HideSeekPhysics } from '../physics';
import { AGENT_GROUPS, BOX_GROUPS, WALL_GROUPS } from './groups';
import type { Rapier } from './rapier';

export interface ArenaBodies {
  world: World;
  /** In agent slot order: hider then seeker in a match, hiders then seekers in the Sandbox. */
  agents: RigidBody[];
  boxes: RigidBody[];
}

/** A box to build: where it starts and whether it is a cube or a plank. */
export interface BoxSpawn {
  pose: Pose;
  kind: BoxKind;
}

/** Wall friction. Low, so agents slide along walls instead of sticking to them. */
const WALL_FRICTION = 0.3;

/**
 * Builds a room in a new Rapier world, with every moving body at its start
 * pose: fixed walls first, then the agents, then the boxes. The order never
 * changes, so two builds of the same setup are identical.
 *
 * Agents and boxes move only on the floor plane: y translation and tilting
 * are locked, only yaw is free. That keeps building stable (nothing tips
 * over) and means there is no floor collider at all, so the solver only
 * works on real contacts. Box damping stands in for floor friction.
 */
export function buildRoom(R: Rapier, p: HideSeekPhysics, walls: Rect[], agentPoses: Pose[], boxSpawns: BoxSpawn[]): ArenaBodies {
  const world = new R.World({ x: 0, y: 0, z: 0 });
  world.timestep = p.dt;
  world.numSolverIterations = p.solverIterations;
  const wallHalfHeight = p.arena.wallHeight / 2;
  for (const w of walls) {
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(w.x, wallHalfHeight, w.z));
    const desc = R.ColliderDesc.cuboid(w.hx, wallHalfHeight, w.hz).setFriction(WALL_FRICTION).setCollisionGroups(WALL_GROUPS);
    world.createCollider(desc, body);
  }

  const a = p.agent;
  const agents: RigidBody[] = [];
  for (const pose of agentPoses) {
    const body = world.createRigidBody(planarBody(R, pose, a.height / 2));
    // A capsule whose straight part spans the middle of the body. Its full
    // radius covers the ray height and the whole height of a box face.
    const desc = R.ColliderDesc.capsule(a.height / 2 - a.radius, a.radius)
      .setMass(a.mass)
      .setFriction(a.friction)
      .setCollisionGroups(AGENT_GROUPS);
    world.createCollider(desc, body);
    agents.push(body);
  }

  const boxes: RigidBody[] = [];
  for (const spawn of boxSpawns) {
    const size = boxKindSize(p, spawn.kind);
    const desc = planarBody(R, spawn.pose, size.height / 2)
      .setLinearDamping(p.box.linearDamping)
      .setAngularDamping(p.box.angularDamping);
    const body = world.createRigidBody(desc);
    const shape = R.ColliderDesc.cuboid(size.length / 2, size.height / 2, size.width / 2)
      .setMass(p.box.mass)
      .setFriction(p.box.friction)
      .setCollisionGroups(BOX_GROUPS);
    world.createCollider(shape, body);
    boxes.push(body);
  }
  return { world, agents, boxes };
}

/** A 1 v 1 room: the layout's walls, the hider and the seeker, then the four boxes in BOX_KINDS order. */
export function buildArena(R: Rapier, layout: ArenaLayout, p: HideSeekPhysics, setup: MatchSetup): ArenaBodies {
  const boxes = setup.boxes.map((pose, i) => ({ pose, kind: BOX_KINDS[i] }));
  return buildRoom(R, p, arenaWallRects(layout, p), setup.agents, boxes);
}

/**
 * A dynamic body that slides and spins on the floor plane. It never sleeps,
 * so the set of active bodies, and with it the solver order, stays fixed.
 */
function planarBody(R: Rapier, pose: Pose, y: number) {
  return R.RigidBodyDesc.dynamic()
    .setTranslation(pose.x, y, pose.z)
    .setRotation(yawToQuat(pose.yaw, { x: 0, y: 0, z: 0, w: 1 }))
    .enabledTranslations(true, false, true)
    .enabledRotations(false, true, false)
    .setGravityScale(0)
    .setCanSleep(false);
}

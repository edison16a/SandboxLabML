import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { arenaWallRects } from '../layouts/geometry';
import type { ArenaLayout } from '../layouts/types';
import { BOX_COUNT, boxSize, type HideSeekPhysics } from '../physics';
import { AGENT_GROUPS, BOX_GROUPS, WALL_GROUPS } from './groups';
import type { Rapier } from './rapier';

export interface ArenaBodies {
  /** Hider first, then seeker. */
  agents: RigidBody[];
  boxes: RigidBody[];
}

/** Wall friction. Low, so agents slide along walls instead of sticking to them. */
const WALL_FRICTION = 0.3;

/**
 * Builds a room inside an empty world: fixed walls, then the two agents,
 * then the four boxes. The order never changes, so body handles and solver
 * order are the same in every copy of a layout.
 *
 * Agents and boxes move only on the floor plane: y translation and tilting
 * are locked, only yaw is free. That keeps building stable (nothing tips
 * over) and means there is no floor collider at all, so the solver only
 * works on real contacts. Box damping stands in for floor friction.
 */
export function buildArena(R: Rapier, world: World, layout: ArenaLayout, p: HideSeekPhysics): ArenaBodies {
  const wallHalfHeight = p.arena.wallHeight / 2;
  for (const w of arenaWallRects(layout, p)) {
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(w.x, wallHalfHeight, w.z));
    const desc = R.ColliderDesc.cuboid(w.hx, wallHalfHeight, w.hz).setFriction(WALL_FRICTION).setCollisionGroups(WALL_GROUPS);
    world.createCollider(desc, body);
  }

  const a = p.agent;
  const agents: RigidBody[] = [];
  for (let i = 0; i < 2; i++) {
    const body = world.createRigidBody(planarBody(R).setTranslation(i * 2, a.height / 2, 0));
    // A capsule whose straight part spans the middle of the body. Its full radius
    // covers the ray height and the whole height of a box face.
    const desc = R.ColliderDesc.capsule(a.height / 2 - a.radius, a.radius)
      .setMass(a.mass)
      .setFriction(a.friction)
      .setCollisionGroups(AGENT_GROUPS);
    world.createCollider(desc, body);
    agents.push(body);
  }

  const boxes: RigidBody[] = [];
  for (let i = 0; i < BOX_COUNT; i++) {
    const size = boxSize(p, i);
    const spot = layout.boxes[i];
    const body = world.createRigidBody(
      planarBody(R)
        .setTranslation(spot.x, size.height / 2, spot.z)
        .setLinearDamping(p.box.linearDamping)
        .setAngularDamping(p.box.angularDamping),
    );
    const desc = R.ColliderDesc.cuboid(size.length / 2, size.height / 2, size.width / 2)
      .setMass(p.box.mass)
      .setFriction(p.box.friction)
      .setCollisionGroups(BOX_GROUPS);
    world.createCollider(desc, body);
    boxes.push(body);
  }
  return { agents, boxes };
}

/** A dynamic body that slides and spins on the floor plane and never sleeps. */
function planarBody(R: Rapier) {
  return R.RigidBodyDesc.dynamic()
    .enabledTranslations(true, false, true)
    .enabledRotations(false, true, false)
    .setGravityScale(0)
    .setCanSleep(false);
}

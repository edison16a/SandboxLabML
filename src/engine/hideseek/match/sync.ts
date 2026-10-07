import type { RigidBody } from '@dimforge/rapier3d-compat';
import { localAhead, localLeft, type Pose } from '../frame';
import type { HideSeekAgent } from '../agents/agent';
import type { BoxState, MatchState, PlayState } from './state';

/**
 * Copies the world after a physics step into the match state: agent and
 * box poses, agent speeds in the agent frame and how far each box moved.
 */
export function syncFromPhysics(s: PlayState): void {
  const arena = s.arena;
  for (let i = 0; i < s.agents.length; i++) {
    const a = s.agents[i];
    const v = s.controls[i].measured;
    arena.readPose(arena.agents[i], a);
    arena.readVelocity(arena.agents[i], v);
    a.speed = localAhead(v.vx, v.vz, a.yaw);
    a.sideSpeed = localLeft(v.vx, v.vz, a.yaw);
  }
  for (let i = 0; i < s.boxes.length; i++) {
    const b = s.boxes[i];
    const px = b.x;
    const pz = b.z;
    arena.readPose(arena.boxes[i], b);
    b.travel += Math.hypot(b.x - px, b.z - pz);
  }
  keepInside(s);
}

/**
 * Safety net for the rare solver blow-up that pops a body through an outer
 * wall: anything outside the room is put back just inside and stopped.
 * Deterministic like everything else, so replays still match.
 */
function keepInside(s: PlayState): void {
  for (let i = 0; i < s.agents.length; i++) putInside(s, s.arena.agents[i], s.agents[i], s.physics.agent.radius);
  for (let i = 0; i < s.boxes.length; i++) putInside(s, s.arena.boxes[i], s.boxes[i], s.physics.box.plank.length / 2);
}

function putInside(s: PlayState, body: RigidBody, pose: Pose, margin: number): void {
  const half = s.physics.arena.size / 2;
  if (Math.abs(pose.x) <= half && Math.abs(pose.z) <= half) return;
  const lim = half - margin;
  pose.x = Math.max(-lim, Math.min(lim, pose.x));
  pose.z = Math.max(-lim, Math.min(lim, pose.z));
  s.arena.teleport(body, pose);
}

/** Clock fields on every agent for the tick that just finished. */
export function updateClock(s: PlayState): void {
  const dt = s.physics.dt;
  const prep = s.tick <= s.prepTicks;
  for (const a of s.agents) {
    a.time = s.tick * dt;
    a.timeLeft = (s.totalTicks - s.tick) * dt;
    a.prep = prep;
  }
}

/** Boxes locked by the agent's team and by the other team, for scripts. Shared with the Sandbox. */
export function countLocks(boxes: readonly BoxState[], a: HideSeekAgent): void {
  let own = 0;
  let other = 0;
  for (const b of boxes) {
    if (b.lockedBy === a.index) own++;
    else if (b.lockedBy >= 0) other++;
  }
  a.boxesLockedByTeam = own;
  a.boxesLockedByOpponent = other;
}

/** Distances and counts that scripts read directly, for a 1 v 1 match. The Sandbox has its own. */
export function updateDerived(s: MatchState): void {
  const [h, k] = s.agents;
  const d = Math.hypot(h.x - k.x, h.z - k.z);
  h.opponentDistance = d;
  k.opponentDistance = d;
  for (const a of s.agents) {
    countLocks(s.boxes, a);
    let nearest = Infinity;
    for (const b of s.boxes) nearest = Math.min(nearest, Math.hypot(b.x - a.x, b.z - a.z));
    a.nearestBoxDistance = nearest;
  }
}

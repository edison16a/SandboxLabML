import type { RigidBody } from '@dimforge/rapier3d-compat';
import { localAhead, localLeft, type Pose } from '../frame';
import type { HideSeekAgent } from '../agents/agent';
import { placeClimbers } from '../agents/climb/ramp';
import type { BoxState, MatchState, PlayState } from './state';

/**
 * Copies the world after a physics step into the match state: agent and
 * box poses, agent speeds in the agent frame and how far each box moved.
 * Climbers then follow their ramps to wherever the step moved them.
 */
export function syncFromPhysics(s: PlayState): void {
  const arena = s.arena;
  for (let i = 0; i < s.agents.length; i++) {
    const a = s.agents[i];
    // The engine places agents on ramps and in the air itself (see agents/climb).
    if (a.climbing || a.airborne) continue;
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
  placeClimbers(s);
}

/**
 * Safety net for the rare solver blow-up that pops a body through an outer
 * wall: anything outside the room is put back just inside and stopped.
 * Deterministic like everything else, so replays still match.
 */
function keepInside(s: PlayState): void {
  for (let i = 0; i < s.agents.length; i++) if (!s.agents[i].climbing && !s.agents[i].airborne) putInside(s, s.arena.agents[i], s.agents[i], s.physics.agent.radius);
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

/**
 * The box fields scripts read, in one pass: distance to the nearest crate
 * (cube or plank) and to the nearest ramp, `far` when there is none, and
 * how many boxes each team holds locked. Shared with the Sandbox.
 */
export function updateBoxFields(boxes: readonly BoxState[], a: HideSeekAgent, far: number): void {
  let crate = Infinity;
  let ramp = Infinity;
  let own = 0;
  let other = 0;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (b.kind === 'ramp') ramp = Math.min(ramp, d);
    else crate = Math.min(crate, d);
    if (b.lockedBy === a.index) own++;
    else if (b.lockedBy >= 0) other++;
  }
  a.nearestBoxDistance = crate === Infinity ? far : crate;
  a.nearestRampDistance = ramp === Infinity ? far : ramp;
  a.boxesLockedByTeam = own;
  a.boxesLockedByOpponent = other;
}

/** Distances and counts that scripts read directly, for a 1 v 1 match. The Sandbox has its own. */
export function updateDerived(s: MatchState): void {
  const [h, k] = s.agents;
  const d = Math.hypot(h.x - k.x, h.z - k.z);
  h.opponentDistance = d;
  k.opponentDistance = d;
  const far = s.physics.arena.size * Math.SQRT2;
  for (let i = 0; i < s.agents.length; i++) updateBoxFields(s.boxes, s.agents[i], far);
}

import { clamp, wrapAngle } from '../../core/math';
import { FLAG_PUSHED, FLAG_TOUCHING, type NavAgent } from '../agent';
import type { Course } from '../course/build';
import type { NavigationParams } from '../params';
import { deepestOverlap, type Vec2 } from './collide';
import { CRUSHED, moverPush, slideMove, type CollisionWorld } from './slide';

const pos: Vec2 = { x: 0, z: 0 };

/**
 * Lets the movers shove the agent before it takes its own step. Returns
 * true when it was crushed. Sets the pushed event and flag.
 */
export function shoveAgent(a: NavAgent, p: NavigationParams, w: CollisionWorld): boolean {
  pos.x = a.x;
  pos.z = a.z;
  const bits = moverPush(pos, p.agent.radius, w, p.crushDepth);
  a.x = pos.x;
  a.z = pos.z;
  a.pushed = bits !== 0;
  if (a.pushed) a.flags |= FLAG_PUSHED;
  else a.flags &= ~FLAG_PUSHED;
  return (bits & CRUSHED) !== 0;
}

/**
 * One tick of the agent's own motion, from its move and turn outputs
 * (each -1 to 1). Speed eases toward the commanded speed at the agent's
 * acceleration, so control feels direct without teleporting; the heading
 * turns at up to the turn rate. The step then slides through the world,
 * and speed the agent could not use (it ran into something) is lost, so
 * its speed reads what it really does.
 */
export function driveAgent(a: NavAgent, move: number, turn: number, p: NavigationParams, w: CollisionWorld): void {
  const ag = p.agent;
  const m = clamp(move, -1, 1);
  const target = m >= 0 ? m * ag.maxSpeed : m * ag.maxSpeed * ag.backShare;
  const dv = ag.accel * p.dt;
  a.speed += clamp(target - a.speed, -dv, dv);
  a.turn = clamp(turn, -1, 1) * ag.turnRate;
  a.yaw = wrapAngle(a.yaw + a.turn * p.dt);
  const fx = Math.cos(a.yaw);
  const fz = -Math.sin(a.yaw);
  const x0 = a.x;
  const z0 = a.z;
  pos.x = a.x;
  pos.z = a.z;
  const hits = slideMove(pos, fx * a.speed * p.dt, fz * a.speed * p.dt, ag.radius, w);
  a.x = pos.x;
  a.z = pos.z;
  a.vx = (a.x - x0) / p.dt;
  a.vz = (a.z - z0) / p.dt;
  a.touching = hits !== 0;
  if (a.touching) {
    a.flags |= FLAG_TOUCHING;
    const along = a.vx * fx + a.vz * fz;
    if (Math.abs(along) < Math.abs(a.speed)) a.speed = along;
  } else a.flags &= ~FLAG_TOUCHING;
}

/** Whether the agent stands far enough onto any spike pad to be hurt. */
export function onSpikes(a: NavAgent, course: Course, p: NavigationParams): boolean {
  return deepestOverlap(a.x, a.z, p.agent.radius, course.spikeData, course.spikes.length) > p.spikeInset;
}

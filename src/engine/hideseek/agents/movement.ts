import { clamp } from '../../core/math';
import type { PlayState } from '../match/state';
import { SEEKER } from './agent';

/**
 * Turns the move and turn outputs into a velocity for the coming step.
 * This is velocity control on a dynamic body: the agent always asks for
 * the commanded speed and the solver decides how much survives contact,
 * which is what lets agents push boxes and each other. Backing up is
 * capped at a share of the forward speed.
 */
export function driveAgent(s: PlayState, i: number): void {
  const a = s.agents[i];
  const c = s.controls[i];
  const cmd = c.command;
  if (a.frozen) {
    // A frozen body has every axis locked, so there is nothing to command.
    cmd.vx = 0;
    cmd.vz = 0;
    cmd.spin = 0;
    return;
  }
  const p = s.physics.agent;
  const move = clamp(c.move, -1, 1);
  const speed = move >= 0 ? move * p.maxSpeed : move * p.maxSpeed * p.backwardShare;
  cmd.vx = Math.cos(a.yaw) * speed;
  cmd.vz = -Math.sin(a.yaw) * speed;
  cmd.spin = clamp(c.turn, -1, 1) * p.turnRate;
  s.arena.setVelocity(s.arena.agents[i], cmd.vx, cmd.vz, cmd.spin);
}

/**
 * Freezes or frees an agent for the coming step. Seekers are frozen for
 * every prep step, and an agent its controller stopped stays frozen for
 * the rest of the match. Only touches the body when the state changes.
 */
export function updateFreeze(s: PlayState, i: number, nextTick: number): void {
  const a = s.agents[i];
  const frozen = a.stopReason !== null || (a.index === SEEKER && nextTick <= s.prepTicks);
  if (frozen === a.frozen) return;
  a.frozen = frozen;
  s.arena.setFrozen(i, frozen);
}

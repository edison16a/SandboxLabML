import type { AgentController, TickIO } from '../env/types';
import type { HideSeekAgent } from './agents/agent';

export type HideSeekRewardId = 'v1' | 'starter';

/** Brain outputs become actions unchanged: move, turn, grab, lock. */
function copyBrain(io: TickIO): void {
  for (let k = 0; k < io.action.length; k++) io.action[k] = io.brain[k];
}

/** Whether things are going this agent's way right now: hidden for a hider, seeing for a seeker. */
function winning(a: HideSeekAgent): boolean {
  return a.team === 'hider' ? a.hidden : a.seesOpponent;
}

/**
 * The v1 rewards, used when a run has no script. Rewards are per second,
 * so each tick adds value times dt. Nothing is scored during prep. In the
 * seek phase the hider earns +1/s while hidden and -1/s while seen, and the
 * seeker earns +1/s while it sees the hider and -1/s while it does not, so
 * the game is zero sum. As a script:
 *
 *   act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)
 *   reward +1 per second when hidden (hiders)
 *   reward -1 per second when seen (hiders)
 *   reward +1 per second when seesOpponent (seekers)
 *   reward -1 per second when not seesOpponent (seekers)
 */
export const v1HideSeekController: AgentController<HideSeekAgent> = {
  customSensorCount: 0,
  sensors() {},
  tick(a: HideSeekAgent, io: TickIO) {
    copyBrain(io);
    if (a.prep) return;
    io.reward = (winning(a) ? 1 : -1) * a.dt;
  },
};

/**
 * The Starter rewards: only the good half of v1. The hider earns +1/s while
 * hidden and the seeker +1/s while it sees the hider, with no penalties.
 * Gentler on brand new brains, at the cost of a weaker push early on.
 */
export const starterHideSeekController: AgentController<HideSeekAgent> = {
  customSensorCount: 0,
  sensors() {},
  tick(a: HideSeekAgent, io: TickIO) {
    copyBrain(io);
    if (a.prep) return;
    io.reward = winning(a) ? a.dt : 0;
  },
};

export const HIDESEEK_REWARDS: Record<HideSeekRewardId, AgentController<HideSeekAgent>> = {
  v1: v1HideSeekController,
  starter: starterHideSeekController,
};

export function builtinHideSeekController(id: HideSeekRewardId = 'v1'): AgentController<HideSeekAgent> {
  const controller = HIDESEEK_REWARDS[id];
  if (!controller) throw new Error(`Unknown Hide and Seek reward "${id}".`);
  return controller;
}

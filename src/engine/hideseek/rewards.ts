import type { AgentController, TickIO } from '../env/types';
import type { HideSeekAgent } from './agents/agent';

export type HideSeekRewardId = 'v1' | 'starter' | 'cover';

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
 * the game is zero sum. As a script (the Intermediate preset, which a test
 * holds to exactly the same results):
 *
 *   act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)
 *   if agent.isHider {
 *     reward +1 * dt when agent.hidden
 *     reward -1 * dt when agent.seen
 *   } else {
 *     reward +1 * dt when agent.seesOpponent
 *     reward -1 * dt when not agent.prep and not agent.seesOpponent
 *   }
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

/**
 * The cover rewards: v1 with a neutral middle. In the seek phase the hider
 * earns +1/s only while it is covered (out of the seeker's range or behind
 * a wall or box, see HideSeekAgent.exposed) and -1/s while seen. Being out
 * of sight only because the seeker looks the other way scores 0. The
 * seeker gets the exact opposite, so the game stays zero sum.
 *
 * Why: under v1 a hider facing a clumsy seeker is "hidden" almost all the
 * time wherever it stands, so every hider scores near the maximum and
 * selection cannot tell skill from luck. Cover does not depend on how good
 * the seeker is, so hiders get a clear signal from the first generation,
 * and seekers get one for finding a line of sight before they can aim. As
 * a script:
 *
 *   reward +1 * dt when agent.hidden and not agent.exposed (hiders)
 *   reward -1 * dt when agent.seen (hiders)
 *   reward +1 * dt when agent.seesOpponent (seekers)
 *   reward -1 * dt when not agent.prep and not agent.exposed (seekers)
 */
export const coverHideSeekController: AgentController<HideSeekAgent> = {
  customSensorCount: 0,
  sensors() {},
  tick(a: HideSeekAgent, io: TickIO) {
    copyBrain(io);
    if (a.prep) return;
    const score = a.seen ? -1 : a.exposed ? 0 : 1;
    io.reward = (a.team === 'hider' ? score : -score) * a.dt;
  },
};

export const HIDESEEK_REWARDS: Record<HideSeekRewardId, AgentController<HideSeekAgent>> = {
  v1: v1HideSeekController,
  starter: starterHideSeekController,
  cover: coverHideSeekController,
};

export function builtinHideSeekController(id: HideSeekRewardId = 'v1'): AgentController<HideSeekAgent> {
  const controller = HIDESEEK_REWARDS[id];
  if (!controller) throw new Error(`Unknown Hide and Seek reward "${id}".`);
  return controller;
}

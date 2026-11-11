import type { AgentController, TickIO } from '../env/types';
import type { NavAgent } from './agent';

/** Reward for covering the whole walking distance, paid as progress is made. */
export const PROGRESS_REWARD = 10;
/** Reward for crossing the line, plus up to the same again for time to spare. */
export const FINISH_REWARD = 10;
export const TIME_BONUS = 10;
/** Taken away for dying on spikes or under a mover. */
export const DEATH_PENALTY = 3;
/** Taken away each tick spent standing still (under 0.3 m/s), so waiting has a small price. */
export const IDLE_PENALTY = 0.005;
/**
 * Taken away each tick spent backing up. Backing turns twice as tight as
 * running, so without it a population soon reverses all the way to the
 * line: safe round crates, but slow and odd to watch. A short step back
 * out of a corner still costs little.
 */
export const BACK_PENALTY = 0.03;

/**
 * The reward used when a run has no script. It runs as plain TypeScript,
 * so it doubles as the speed baseline compiled scripts are measured
 * against. Written as a script it would read:
 *
 *   act(move: brain.move, turn: brain.turn)
 *   reward +10 * agent.progressGain
 *   reward +10 + 10 * agent.timeLeft / (agent.time + agent.timeLeft) when agent.finished
 *   reward -3 when agent.died
 *   reward -0.005 when abs(agent.speed) < 0.3 m/s
 *   reward -0.03 when agent.speed <= -0.3 m/s
 *
 * Progress is the share of the start's walking distance, so the whole run
 * is worth 10, a finish 10 to 20, and a death undoes part of the way. Runs
 * that stop getting closer end as stuck by the env's own rule.
 */
export const builtinNavigationController: AgentController<NavAgent> = {
  customSensorCount: 0,
  sensors() {},
  tick(a: NavAgent, io: TickIO) {
    io.action[0] = io.brain[0];
    io.action[1] = io.brain[1];
    let r = PROGRESS_REWARD * a.progressGain;
    if (a.finishedNow) r += FINISH_REWARD + TIME_BONUS * Math.max(0, 1 - a.time / a.timeLimit);
    if (a.diedNow) r -= DEATH_PENALTY;
    if (Math.abs(a.speed) < 0.3) r -= IDLE_PENALTY;
    else if (a.speed < 0) r -= BACK_PENALTY;
    io.reward = r;
  },
};

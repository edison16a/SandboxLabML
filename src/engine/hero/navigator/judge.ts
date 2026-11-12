import { NAV_FINISHED, NAV_RUNNING } from '../../navigation/agent';
import { builtinNavigationController } from '../../navigation/builtinReward';
import type { Course } from '../../navigation/course/build';
import { NavigationEnv, type NavBrain } from '../../navigation/env';
import { DEFAULT_NAVIGATION_PARAMS } from '../../navigation/params';
import type { NavigationInputConfig } from '../../navigation/sensors/inputConfig';
import { Network } from '../../neat/network';
import type { Genome } from '../../neat/types';

/** How one hero course went, from a headless run of the whole course. */
export interface RunReport {
  finished: boolean;
  /** Why it stopped: "finished", "spikes", "crushed", "time" or "stuck". */
  stopReason: string | null;
  seconds: number;
  /** Seconds spent backing up and pressed against a wall or a crate: a clean run has little of either. */
  backing: number;
  touching: number;
  /** Mean change of the turn per tick: a runner that wobbles reads as lost. */
  wobble: number;
}

/** A fresh env for one course with `brain` running it alone, the way the landing page builds it. */
export function courseEnv(brain: NavBrain, inputs: NavigationInputConfig, course: Course, slot: number, seed: number): NavigationEnv {
  const env = new NavigationEnv({ course, params: DEFAULT_NAVIGATION_PARAMS, inputs, controller: builtinNavigationController });
  env.reset([brain], [seed], [slot]);
  return env;
}

/** Runs one course to its end and reports how it went. */
export function judgeRun(genome: Genome, inputs: NavigationInputConfig, course: Course, slot: number, seed: number): RunReport {
  const env = courseEnv(new Network(genome), inputs, course, slot, seed);
  const a = env.agents[0];
  const dt = DEFAULT_NAVIGATION_PARAMS.dt;
  let backing = 0;
  let touching = 0;
  let wobble = 0;
  let lastTurn = 0;
  while (a.status === NAV_RUNNING) {
    env.step();
    if (a.speed < -0.2) backing += dt;
    if (a.touching) touching += dt;
    wobble += Math.abs(a.turn - lastTurn);
    lastTurn = a.turn;
  }
  return { finished: a.status === NAV_FINISHED, stopReason: a.stopReason, seconds: a.time, backing, touching, wobble: wobble / Math.max(1, env.tick) };
}

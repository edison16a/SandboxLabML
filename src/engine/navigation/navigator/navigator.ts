import { clamp, wrapAngle } from '../../core/math';
import { mixSeed, Rng } from '../../core/rng';
import type { AgentController, TickIO } from '../../env/types';
import type { NavAgent } from '../agent';
import { builtinNavigationController } from '../builtinReward';
import type { Course } from '../course/build';
import { sampleFlow } from '../course/fieldSample';
import type { NavBrain } from '../env';
import type { NavigationParams } from '../params';
import { planIsSafe } from './predict';

/**
 * How well a scripted navigator walks. The perfect one is the benchmark
 * yardstick; looser ones make a believable crowd for previews: some
 * slower, some unsteady, some cutting corners or too bold at movers.
 */
export interface NavigatorSkill {
  /** Share of top speed it walks at. */
  pace: number;
  /** Steering wander, rad, as a slow smooth sway. */
  wobble: number;
  /** How far it leans its line from the path hint toward the straight way to the finish, 0 to 1. Brushes spikes when high. */
  shortcut: number;
  /** Whether it times movers at all. */
  careful: boolean;
  /** Sway frequency and phase, from its seed, so a crowd does not sway in step. */
  swayRate: number;
  swayPhase: number;
}

export const PERFECT_NAVIGATOR: NavigatorSkill = { pace: 1, wobble: 0, shortcut: 0, careful: true, swayRate: 0, swayPhase: 0 };

/** A crowd member's skill from its seed: most walk well, a few are clumsy or reckless. */
export function crowdSkill(seed: number): NavigatorSkill {
  const r = new Rng(mixSeed(seed, 0x6e61));
  const clumsy = r.chance(0.3);
  return {
    pace: r.range(0.72, 1),
    wobble: clumsy ? r.range(0.25, 0.7) : r.range(0, 0.18),
    shortcut: clumsy ? r.range(0.2, 0.6) : r.range(0, 0.12),
    careful: !r.chance(0.18),
    swayRate: r.range(0.6, 1.6),
    swayPhase: r.range(0, Math.PI * 2),
  };
}

const flow = { x: 0, z: 0 };

/**
 * Writes move and turn (each -1 to 1) for an agent following the path
 * hint: turn toward it, slow down to turn sharply, and at movers pick the
 * first safe plan of three (go on, wait, back off), so it dashes through
 * a gap only when the mover will not get there first.
 */
export function navigate(a: NavAgent, course: Course, params: NavigationParams, skill: NavigatorSkill, out: Float64Array): void {
  sampleFlow(course.field, a.x, a.z, flow);
  let dx = flow.x + skill.shortcut;
  let dz = flow.z;
  const len = Math.hypot(dx, dz);
  dx /= len;
  dz /= len;
  const sway = skill.wobble * Math.sin(a.time * skill.swayRate * 2 * Math.PI + skill.swayPhase);
  const bearing = wrapAngle(Math.atan2(-dz, dx) - a.yaw + sway);
  out[1] = clamp(bearing * 3, -1, 1);
  const turning = Math.abs(bearing);
  let move = turning > 1.3 ? 0.15 : turning > 0.6 ? 0.6 * skill.pace : skill.pace;
  if (skill.careful && course.movers.length > 0) {
    const speed = params.agent.maxSpeed * move;
    const r = params.agent.radius;
    if (!planIsSafe(course, a.x, a.z, r, a.time, speed)) {
      if (planIsSafe(course, a.x, a.z, r, a.time, 0)) move = 0;
      else if (planIsSafe(course, a.x, a.z, r, a.time, -params.agent.maxSpeed * params.agent.backShare)) move = -1;
    }
  }
  out[0] = move;
}

/** A brain that does nothing, for agents driven by a scripted controller. */
export const IDLE_BRAIN: NavBrain = { activate() {} };

/**
 * A controller that ignores the brain and walks like the navigator, while
 * scoring with the built in reward. `skillOf` picks each agent's skill;
 * by default every agent is perfect. Used to test courses, as the
 * benchmark par and to drive the preview crowd.
 */
export function navigatorController(course: Course, params: NavigationParams, skillOf: (a: NavAgent) => NavigatorSkill = () => PERFECT_NAVIGATOR): AgentController<NavAgent> {
  return {
    customSensorCount: 0,
    sensors() {},
    tick(a: NavAgent, io: TickIO) {
      builtinNavigationController.tick(a, io);
      navigate(a, course, params, skillOf(a), io.action);
    },
  };
}

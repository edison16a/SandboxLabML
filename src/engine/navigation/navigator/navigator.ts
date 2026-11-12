import { clamp, wrapAngle } from '../../core/math';
import type { AgentController, TickIO } from '../../env/types';
import type { NavAgent } from '../agent';
import { builtinNavigationController } from '../builtinReward';
import type { Course } from '../course/build';
import { sampleFlow } from '../course/fieldSample';
import type { NavBrain } from '../env';
import type { NavigationParams } from '../params';
import { planCrossing, type CrossingOrder } from './crossing';
import { createMemory, type NavigatorMemory } from './memory';

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

const flow = { x: 0, z: 0 };
const order: CrossingOrder = { move: 0, hx: 1, hz: 0 };

/**
 * Writes move and turn (each -1 to 1) for an agent following the path
 * hint: turn toward it and slow down to turn sharply. A careful one plans
 * its way past movers (see planCrossing): it lines up short of a mover's
 * floor and dashes across a lane only when no mover will reach it there.
 * `memory` keeps those choices steady from tick to tick.
 */
export function navigate(a: NavAgent, course: Course, params: NavigationParams, skill: NavigatorSkill, out: Float64Array, memory: NavigatorMemory | null = null): void {
  let dx: number;
  let dz: number;
  let pace = skill.pace;
  if (skill.careful && planCrossing(a, course, params, skill.pace, memory, order)) {
    dx = order.hx;
    dz = order.hz;
    pace = order.move;
  } else {
    sampleFlow(course.field, a.x, a.z, flow);
    dx = flow.x + skill.shortcut;
    dz = flow.z;
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
  }
  const sway = skill.wobble * Math.sin(a.time * skill.swayRate * 2 * Math.PI + skill.swayPhase);
  const bearing = wrapAngle(Math.atan2(-dz, dx) - a.yaw + sway);
  out[1] = clamp(bearing * 3, -1, 1);
  // Backing out of a mover's way keeps its heading; anything else slows down to turn sharply.
  const turning = pace < 0 ? 0 : Math.abs(bearing);
  out[0] = turning > 1.3 ? Math.min(pace, 0.15) : turning > 0.6 ? 0.6 * pace : pace;
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
  const memories: NavigatorMemory[] = [];
  return {
    customSensorCount: 0,
    sensors() {},
    tick(a: NavAgent, io: TickIO) {
      builtinNavigationController.tick(a, io);
      navigate(a, course, params, skillOf(a), io.action, (memories[a.index] ??= createMemory()));
    },
  };
}

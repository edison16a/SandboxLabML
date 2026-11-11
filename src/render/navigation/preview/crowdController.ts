import type { AgentController, TickIO } from '@/engine/env/types';
import type { NavAgent } from '@/engine/navigation/agent';
import { builtinNavigationController } from '@/engine/navigation/builtinReward';
import type { Course } from '@/engine/navigation/course/build';
import { createMemory, type NavigatorMemory } from '@/engine/navigation/navigator/memory';
import { crowdSkill, navigate, type NavigatorSkill } from '@/engine/navigation/navigator/navigator';
import type { NavigationParams } from '@/engine/navigation/params';

/**
 * The preview crowd: scripted navigators of mixed skill, some slower, some
 * unsteady, a few careless at movers. Like the learners in the lab, they
 * start together from the grid and walk through each other, so the
 * preview shows what a training run will show.
 */
export function crowdController(course: Course, params: NavigationParams): AgentController<NavAgent> {
  const skills: NavigatorSkill[] = [];
  const memories: NavigatorMemory[] = [];
  return {
    customSensorCount: 0,
    sensors() {},
    tick(a: NavAgent, io: TickIO) {
      builtinNavigationController.tick(a, io);
      skills[a.index] ??= crowdSkill(a.seed);
      navigate(a, course, params, skills[a.index], io.action, (memories[a.index] ??= createMemory()));
    },
  };
}

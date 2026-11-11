import type { AgentController, TickIO } from '@/engine/env/types';
import { NAV_RUNNING, type NavAgent } from '@/engine/navigation/agent';
import { builtinNavigationController } from '@/engine/navigation/builtinReward';
import type { Course } from '@/engine/navigation/course/build';
import { rectDistance } from '@/engine/navigation/course/field';
import { crowdSkill, navigate, type NavigatorSkill, type Steer } from '@/engine/navigation/navigator/navigator';
import type { NavigationParams } from '@/engine/navigation/params';

/** Others nearer than this push a crowd member aside, m: about two body widths. */
const PERSONAL = 1.25;
/** How hard they push, as a share of the path hint's pull. */
const PUSH = 1.6;

/**
 * The preview crowd: scripted navigators of mixed skill that also keep a
 * little room from each other, so they spread across open floor and queue
 * at gaps like a crowd rather than walking in one file through the same
 * spot. Learners never see each other; this is only how the stand in
 * crowd behaves, and it never affects anything a brain is scored on.
 */
export function crowdController(course: Course, params: NavigationParams, agents: () => readonly NavAgent[]): AgentController<NavAgent> {
  const skills: NavigatorSkill[] = [];
  const steer: Steer = { x: 0, z: 0, pace: 1 };
  return {
    customSensorCount: 0,
    sensors() {},
    tick(a: NavAgent, io: TickIO) {
      builtinNavigationController.tick(a, io);
      skills[a.index] ??= crowdSkill(a.seed);
      makeRoom(a, agents(), steer, nearSpikes(a, course));
      navigate(a, course, params, skills[a.index], io.action, steer);
    },
  };
}

/** How much room to make, 0.1 to 1: little near spikes, where a shove would be fatal and queueing is wiser. */
function nearSpikes(a: NavAgent, course: Course): number {
  let near = Infinity;
  for (let i = 0; i < course.spikes.length; i++) near = Math.min(near, rectDistance(a.x, a.z, course.spikes[i]));
  return Math.max(0.1, Math.min(1, (near - 0.7) / 1.3));
}

/** Sums the pushes of everyone too close into `out`, scaled by `room`, and slows the agent when someone is right in front of it. */
function makeRoom(a: NavAgent, all: readonly NavAgent[], out: Steer, room: number): void {
  out.x = 0;
  out.z = 0;
  out.pace = 1;
  const fx = Math.cos(a.yaw);
  const fz = -Math.sin(a.yaw);
  for (let i = 0; i < all.length; i++) {
    const b = all[i];
    if (b === a || b.status !== NAV_RUNNING) continue;
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= PERSONAL * PERSONAL || d2 < 1e-8) continue;
    const d = Math.sqrt(d2);
    const k = (1 - d / PERSONAL) ** 2;
    out.x += (dx / d) * k * PUSH * room;
    out.z += (dz / d) * k * PUSH * room;
    // Someone close and dead ahead: ease off rather than walk through them.
    const ahead = -(dx * fx + dz * fz) / d;
    if (ahead > 0.75) out.pace = Math.min(out.pace, 0.45 + 0.55 * (d / PERSONAL));
  }
}

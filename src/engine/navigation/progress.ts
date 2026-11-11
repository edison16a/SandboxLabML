import { clamp } from '../core/math';
import { NAV_FINISHED, NAV_RUNNING, type NavAgent } from './agent';
import type { Course } from './course/build';
import { sampleDistance } from './course/fieldSample';

/** Progress an agent must gain to reset its stuck timer, m of walking distance. */
const PROGRESS_STEP = 0.1;

/**
 * Updates an agent's progress from the distance field after it moved: the
 * walking distance left, progress now and at best, the gain this tick and
 * the stuck timer. `mark` is the progress at which its stuck timer last
 * reset; the new mark is returned.
 */
export function updateProgress(a: NavAgent, course: Course, mark: number, dt: number): number {
  const d = a.finishedNow ? 0 : Math.min(sampleDistance(course.field, a.x, a.z), course.startDistance * 2);
  a.distanceLeft = d;
  a.progress = clamp(1 - d / course.startDistance, 0, 1);
  a.progressGain = Math.max(0, a.progress - a.bestProgress);
  if (a.progressGain > 0) a.bestProgress = a.progress;
  if (a.progress > mark + PROGRESS_STEP / course.startDistance) {
    a.noProgress = 0;
    return a.progress;
  }
  a.noProgress += dt;
  return mark;
}

/**
 * Index of the agent doing best: finishers first (earliest wins), then the
 * furthest along of those still running, then the furthest of the rest.
 * -1 when there are no agents.
 */
export function leaderOf(agents: readonly NavAgent[], maxTime: number): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const score = a.status === NAV_FINISHED ? 2 + (1 - a.finishTime / maxTime) : a.status === NAV_RUNNING ? a.progress : a.bestProgress - 1;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

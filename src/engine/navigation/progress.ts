import { clamp } from '../core/math';
import { NAV_FINISHED, NAV_RUNNING, NEAR_CAP, type NavAgent } from './agent';
import { courseShare, type Course } from './course/build';
import { rectDistance } from './course/field';
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
  const d = a.finishedNow ? 0 : Math.min(sampleDistance(course.field, a.x, a.z), a.startDistance * 2);
  a.distanceLeft = d;
  a.progress = clamp(1 - d / a.startDistance, 0, 1);
  a.courseProgress = courseShare(course, d, a.progress);
  a.progressGain = Math.max(0, a.progress - a.bestProgress);
  if (a.progressGain > 0) a.bestProgress = a.progress;
  if (a.progress > mark + PROGRESS_STEP / a.startDistance) {
    a.noProgress = 0;
    return a.progress;
  }
  a.noProgress += dt;
  return mark;
}

/**
 * Index of the agent doing best: finishers first (earliest wins), then the
 * furthest along of those still running (on the course's yardstick, so a
 * spot further back on the grid is no handicap), then the rest by how far
 * they got. -1 when there are no agents.
 */
export function leaderOf(agents: readonly NavAgent[], maxTime: number): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const score = a.status === NAV_FINISHED ? 2 + (1 - a.finishTime / maxTime) : a.status === NAV_RUNNING ? a.courseProgress : a.bestProgress - 2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * How close the agent's edge is to the nearest spike pad and the nearest
 * mover (packed as x, z, hx, hz where they stand now), m. Read by scripts.
 */
export function updateNearby(a: NavAgent, course: Course, movers: Float64Array, radius: number): void {
  let spikes = NEAR_CAP;
  for (let k = 0; k < course.spikes.length; k++) spikes = Math.min(spikes, rectDistance(a.x, a.z, course.spikes[k]) - radius);
  let mover = NEAR_CAP;
  for (let k = 0; k < course.movers.length; k++) {
    const o = k * 4;
    const dx = Math.max(0, Math.abs(a.x - movers[o]) - movers[o + 2]);
    const dz = Math.max(0, Math.abs(a.z - movers[o + 1]) - movers[o + 3]);
    mover = Math.min(mover, Math.hypot(dx, dz) - radius);
  }
  a.spikeDistance = Math.max(0, spikes);
  a.moverDistance = Math.max(0, mover);
}

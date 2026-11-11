import type { EpisodeResult } from '../../env/episode';
import type { NavigationResult } from '../result';

/**
 * One brain's outcome over every course of its generation, the shape the
 * generic trainer stores. Fitness is the mean over the courses, so it
 * reads the same whatever the course count; time is the sum, since every
 * course was really simulated.
 */
export interface NavigationRunResult extends EpisodeResult {
  /** Courses it ran, finished and died on. */
  courses: number;
  finished: number;
  died: number;
  /** Mean best share of its own walk covered, 0 to 1. */
  progress: number;
  /** Mean seconds to the line over the courses it finished, or 0. */
  finishTime: number;
  /** Where its run on the shown course ended, m. */
  endX: number;
  endZ: number;
}

/**
 * Why the runs ended, in one word: a death names its cause, a clean sweep
 * is "finished", else the first reason a course stopped short.
 */
function combinedReason(runs: readonly NavigationResult[]): string | null {
  const death = runs.find((r) => r.died);
  if (death) return death.stopReason;
  const short = runs.find((r) => !r.finished);
  return short ? short.stopReason : (runs[0]?.stopReason ?? null);
}

/** Folds one brain's per course results (course 0 first) into its run result. */
export function combineRuns(runs: readonly NavigationResult[]): NavigationRunResult {
  const n = Math.max(1, runs.length);
  let fitness = 0;
  let time = 0;
  let progress = 0;
  let finished = 0;
  let died = 0;
  let finishTime = 0;
  for (const r of runs) {
    fitness += r.fitness;
    time += r.time;
    progress += r.progress;
    if (r.finished) {
      finished++;
      finishTime += r.finishTime;
    }
    if (r.died) died++;
  }
  return {
    fitness: fitness / n,
    time,
    stopReason: combinedReason(runs),
    courses: runs.length,
    finished,
    died,
    progress: progress / n,
    finishTime: finished > 0 ? finishTime / finished : 0,
    endX: runs[0]?.endX ?? 0,
    endZ: runs[0]?.endZ ?? 0,
  };
}

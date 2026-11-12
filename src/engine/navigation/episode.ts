import { Network } from '../neat/network';
import type { Genome } from '../neat/types';
import type { Course } from './course/build';
import { NavigationEnv, type NavigationEnvOptions } from './env';
import type { NavigationResult } from './result';

/**
 * Runs one course headless: all genomes walk together until every run has
 * ended. Returns one result per genome, in order. `slots` place them on
 * the start grid (see NavigationEnv.reset).
 */
export function evaluateNavigation(genomes: Genome[], opts: NavigationEnvOptions, seeds: number[] = [], slots: number[] = []): NavigationResult[] {
  const env = new NavigationEnv(opts);
  env.reset(
    genomes.map((g) => new Network(g)),
    seeds,
    slots,
  );
  while (!env.done) env.step();
  return env.results();
}

/**
 * Runs several courses one after the other and sums each genome's results:
 * fitness and progress add up, so a brain is judged on all of them. The
 * per course seeds differ, so start spots differ from course to course.
 */
export function evaluateCourses(genomes: Genome[], courses: Course[], base: Omit<NavigationEnvOptions, 'course'>, seeds: number[] = [], slots: number[] = []): NavigationResult[][] {
  return courses.map((course, k) =>
    evaluateNavigation(
      genomes,
      { ...base, course },
      genomes.map((_, i) => (seeds[i] ?? i) + k * 7919),
      slots,
    ),
  );
}

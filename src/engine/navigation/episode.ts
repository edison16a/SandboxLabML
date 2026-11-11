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

/** Path of one agent as flat [x, z, yaw, speed] per tick, for path caches and tests. */
export function recordPath(genome: Genome, opts: NavigationEnvOptions, seed = 0, maxTicks = 3600, slot?: number): Float32Array {
  const env = new NavigationEnv(opts);
  env.reset([new Network(genome)], [seed], slot === undefined ? [] : [slot]);
  const out: number[] = [];
  const snap = new Float32Array(8);
  while (!env.done && env.tick < maxTicks) {
    env.step();
    env.snapshot(snap);
    out.push(snap[0], snap[1], snap[2], snap[3]);
  }
  return Float32Array.from(out);
}

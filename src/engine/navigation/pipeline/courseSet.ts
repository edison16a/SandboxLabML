import type { EpisodeEnv } from '../../env/episode';
import type { Network } from '../../neat/network';
import type { CourseSpec } from '../course/types';
import type { NavigationEnv } from '../env';
import { navigationWorldSize } from '../snapshot';
import { combineRuns, type NavigationRunResult } from './runResult';

/** Seed offset between two courses of a generation, so start jitter and noise differ from course to course (as evaluateCourses does). */
export const COURSE_SEED_STEP = 7919;

/** What the live stream's start message carries for a Navigation episode: the course on screen and where it sits in the set. */
export interface NavigationScene {
  spec: CourseSpec;
  /** Index of the shown course in the generation's set, and how many there are. */
  index: number;
  of: number;
  level: number;
}

/**
 * A generation of Navigation as one episode for the generic pipeline: every
 * brain runs each of the generation's courses, all courses stepped side by
 * side. Course 0 is the one on screen: its agents fill the snapshot, its
 * movers the world block, and its leader is the one the view follows.
 *
 * Once everyone on the shown course has stopped, the next step finishes
 * the other courses at once, so a watched generation never idles on an
 * empty room while an unseen course plays out. The results are the same
 * either way: each course only ever steps its own agents.
 */
export class CourseSetEnv implements EpisodeEnv<NavigationRunResult> {
  readonly worldFloats = navigationWorldSize();
  readonly raysPerAgent: number;

  constructor(
    readonly courses: readonly NavigationEnv[],
    private readonly level: number,
  ) {
    if (courses.length === 0) throw new Error('A Navigation generation needs at least one course.');
    this.raysPerAgent = courses[0].opts.inputs.rays.count;
  }

  private get shown(): NavigationEnv {
    return this.courses[0];
  }

  get agentCount(): number {
    return this.shown.agentCount;
  }

  get tick(): number {
    return this.shown.tick;
  }

  get done(): boolean {
    for (const c of this.courses) if (!c.done) return false;
    return true;
  }

  /** Every course gets the same brains and slots; seeds shift per course. */
  reset(brains: Network[], seeds: number[] = [], slots: number[] = []): void {
    this.courses.forEach((c, k) => {
      c.reset(
        brains,
        brains.map((_, i) => (seeds[i] ?? i) + k * COURSE_SEED_STEP),
        slots,
      );
    });
  }

  step(): void {
    if (!this.shown.done) {
      for (const c of this.courses) if (!c.done) c.step();
      return;
    }
    for (const c of this.courses) while (!c.done) c.step();
  }

  writeSnapshot(out: Float32Array, offset = 0): void {
    this.shown.snapshot(out, offset);
  }

  writeWorld(out: Float32Array, offset: number): void {
    this.shown.writeWorld(out, offset);
  }

  leaderIndex(): number {
    return this.shown.leaderIndex();
  }

  lastObservation(i: number): Float64Array {
    return this.shown.lastObservation(i);
  }

  writeOutputs(i: number, out: Float32Array): void {
    this.shown.writeOutputs(i, out);
  }

  writeRays(i: number, out: Float32Array, offset: number): void {
    const a = this.shown.agents[i];
    const range = this.shown.opts.inputs.rays.range;
    for (let k = 0; k < a.rays.length; k++) out[offset + k] = a.rays[k] / range;
  }

  /** Plain data for the stream's start message, so the viewport builds the very course being run. */
  scene(): NavigationScene {
    return { spec: this.shown.course.spec, index: 0, of: this.courses.length, level: this.level };
  }

  results(): NavigationRunResult[] {
    const perCourse = this.courses.map((c) => c.results());
    return perCourse[0].map((_, i) => combineRuns(perCourse.map((runs) => runs[i])));
  }
}

import { buildCourse } from '../../navigation/course/build';
import { generateCourse } from '../../navigation/course/generate';
import { NAMED_COURSES } from '../../navigation/course/presets';
import type { CourseSpec } from '../../navigation/course/types';
import { DEFAULT_NAVIGATION_PARAMS } from '../../navigation/params';
import type { NavigationInputConfig } from '../../navigation/sensors/inputConfig';
import { mixSeed } from '../../core/rng';
import type { Genome } from '../../neat/types';
import type { HeroCourseRun } from './file';
import { judgeRun, type RunReport } from './judge';

/** A trained brain the hero could show. */
export interface RunnerCandidate {
  label: string;
  genome: Genome;
  blueprint: string;
  inputs: NavigationInputConfig;
}

/** A course a candidate crossed cleanly, from one spot on the grid. */
export interface CoursePick extends HeroCourseRun {
  report: RunReport;
}

/** Spots on the start grid the hero tries, front row first, so the runner starts near the middle of the frame. */
export const HERO_SLOTS = [0, 1, 2, 3, 4, 5] as const;

/** What a hero run may be: a finish without much backing up or scraping along walls. */
export const CLEAN_RUN = { maxBacking: 0.6, maxTouching: 1.5, maxWobble: 1, maxSeconds: 32 };

export function cleanRun(r: RunReport): boolean {
  const c = CLEAN_RUN;
  return r.finished && r.backing <= c.maxBacking && r.touching <= c.maxTouching && r.wobble <= c.maxWobble && r.seconds <= c.maxSeconds;
}

/**
 * The rooms the hero may cross: the named courses with spikes, walls and
 * movers (the held out ones too, since the hero trains nothing), and
 * generated mover and gauntlet levels.
 */
export function heroCourses(generated: number): CourseSpec[] {
  const named = NAMED_COURSES.filter((c) => c.level >= 3).map((c) => {
    const spec: CourseSpec & { heldOut?: boolean } = { ...c };
    delete spec.heldOut;
    return spec;
  });
  const made: CourseSpec[] = [];
  for (let k = 0; k < generated; k++) made.push(generateCourse(5 + (k % 2), mixSeed(0x4e71, k)));
  return [...named, ...made];
}

/** The first spot on the grid from which the candidate crosses the course cleanly, or null. */
export function cleanCrossing(c: RunnerCandidate, spec: CourseSpec): CoursePick | null {
  const course = buildCourse(spec, DEFAULT_NAVIGATION_PARAMS);
  for (const slot of HERO_SLOTS) {
    const seed = mixSeed(0x4e72, slot);
    const report = judgeRun(c.genome, c.inputs, course, slot, seed);
    if (cleanRun(report)) return { spec, slot, seed, report };
  }
  return null;
}

/** What a course shows: movers and spikes are the most fun to watch, and the Gauntlet has everything. */
export function variety(spec: CourseSpec): number {
  const kinds = new Set(spec.obstacles.map((o) => o.kind));
  return kinds.size + (kinds.has('mover') ? 1 : 0) + (spec.id === 'gauntlet' ? 2 : 0);
}

/**
 * The courses the loop plays, in order, at most `count`. It opens on the
 * course with the most to see, never shows two rooms of one name, and
 * takes turns between kinds of room, so two rooms that look alike never
 * follow each other.
 */
export function chooseCourses(picks: readonly CoursePick[], count: number): CoursePick[] {
  const kindsOf = (p: CoursePick) => [...new Set(p.spec.obstacles.map((o) => o.kind))].sort().join();
  const pool = [...picks].sort((a, b) => variety(b.spec) - variety(a.spec) || a.report.seconds - b.report.seconds);
  const chosen: CoursePick[] = [];
  const names = new Set<string>();
  while (chosen.length < count) {
    const last = chosen[chosen.length - 1];
    const fresh = pool.filter((p) => !names.has(p.spec.name));
    const next = fresh.find((p) => !last || kindsOf(p) !== kindsOf(last)) ?? fresh[0];
    if (!next) break;
    chosen.push(next);
    names.add(next.spec.name);
  }
  return chosen;
}

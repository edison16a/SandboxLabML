import { mixSeed } from '../../core/rng';
import { buildCourse, type Course } from '../../navigation/course/build';
import { generateCourse } from '../../navigation/course/generate';
import { NAV_LEVELS } from '../../navigation/course/levels';
import { NAMED_COURSES } from '../../navigation/course/presets';
import type { CourseSpec } from '../../navigation/course/types';
import { NavigationEnv } from '../../navigation/env';
import { IDLE_BRAIN, navigatorController } from '../../navigation/navigator/navigator';
import { DEFAULT_NAVIGATION_PARAMS } from '../../navigation/params';
import { STANDARD_NAVIGATION_INPUTS } from '../../navigation/sensors/inputConfig';

/** The levels the exam covers. Level 0 is an empty room, which tells nothing about navigation. */
export const EXAM_LEVELS = [1, 2, 3, 4, 5, 6] as const;
/** Generated rooms per level, on top of the hand made held out ones. */
export const ROOMS_PER_LEVEL = 2;
/**
 * Start spots each room is run from: the middle of the front row, far to
 * the left in the front row, and right of the middle one row back. A
 * brain that only learned one opening line does not get through all three.
 */
export const EXAM_SLOTS = [0, 9, 25] as const;
/** Seed domain of the exam's generated rooms. Training draws its rooms from another one, so these are never trained on. */
const EXAM_SEED = 0xbe7c;

/** One exam room: a course the brain never trained on, with par for each start spot. */
export interface ExamRoom {
  id: string;
  label: string;
  level: number;
  course: Course;
  /** Spikes or movers in the room, so it counts toward safety. */
  hazards: boolean;
  /** Seconds the perfect scripted navigator takes from each of EXAM_SLOTS. Efficiency is scored against it. */
  par: number[];
}

/** The exam's specs: two generated rooms per level, plus the hand made rooms that are kept out of training. */
export function examSpecs(): CourseSpec[] {
  const generated = EXAM_LEVELS.flatMap((level) => Array.from({ length: ROOMS_PER_LEVEL }, (_, k) => generateCourse(level, mixSeed(EXAM_SEED, level, k))));
  const heldOut = NAMED_COURSES.filter((c) => c.heldOut).map(({ heldOut: _, ...spec }) => spec);
  return [...generated, ...heldOut].sort((a, b) => a.level - b.level);
}

/** Walks the perfect navigator from each exam slot and returns its finish times. */
function parFor(course: Course): number[] {
  const params = DEFAULT_NAVIGATION_PARAMS;
  const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: navigatorController(course, params) });
  env.reset(
    EXAM_SLOTS.map(() => IDLE_BRAIN),
    EXAM_SLOTS.map((_, i) => mixSeed(EXAM_SEED, i)),
    [...EXAM_SLOTS],
  );
  while (!env.done) env.step();
  // The navigator finishes every room (a test checks it), so a missing time only guards against a broken course.
  return env.results().map((r) => (r.finished ? r.finishTime : course.timeLimit));
}

let cached: ExamRoom[] | null = null;

/**
 * The whole exam with par for every start. It is built once per thread
 * from fixed data, so every thread builds the same exam.
 */
export function examRooms(): ExamRoom[] {
  const seen = new Map<number, number>();
  cached ??= examSpecs().map((spec) => {
    const course = buildCourse(spec, DEFAULT_NAVIGATION_PARAMS);
    const named = NAMED_COURSES.some((c) => c.id === spec.id);
    const k = seen.get(spec.level) ?? 0;
    if (!named) seen.set(spec.level, k + 1);
    const label = named ? spec.name : `${NAV_LEVELS[spec.level].name} ${String.fromCharCode(65 + k)}`;
    return { id: spec.id, label, level: spec.level, course, hazards: course.spikes.length > 0 || course.movers.length > 0, par: parFor(course) };
  });
  return cached;
}

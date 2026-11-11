import type { RunConfig } from '../../training/runConfig';
import { trainingCourse } from '../course/presets';
import { TOP_LEVEL } from '../course/levels';
import { DEFAULT_NAVIGATION_PARAMS, type NavigationParams } from '../params';
import type { NavigationInputConfig } from '../sensors/inputConfig';

/** Fewest and most courses one generation may run. More courses judge a brain more fairly but cost time. */
export const MIN_COURSES = 1;
export const MAX_COURSES = 4;
/** Courses per generation by default, the curriculum's own COURSES_PER_GENERATION. Kept here so the light half never loads the course generator. */
export const DEFAULT_COURSES = 2;

/**
 * A Navigation run's own options, frozen in its config as `settings`.
 * The rules (params) are stored whole, so a later change to the defaults
 * never alters an old run.
 */
export interface NavigationSettings {
  /** Level the run starts on, 0 to 6. */
  startLevel: number;
  /** Climb the curriculum on its own. Off keeps every generation on the start level unless a script moves it. */
  autoLevel: boolean;
  /** A named course every generation runs, or null for fresh generated courses each generation. */
  course: string | null;
  /** Generated courses each brain runs per generation. */
  coursesPerGeneration: number;
  params: NavigationParams;
}

/** The settings a new run gets unless the New run dialog says otherwise. */
export function navigationSettings(patch: Partial<NavigationSettings> = {}): NavigationSettings {
  // A held out benchmark room never becomes a run's course.
  const course = patch.course && trainingCourse(patch.course) ? patch.course : null;
  return {
    startLevel: clampLevel(patch.startLevel ?? 0),
    autoLevel: patch.autoLevel ?? true,
    course,
    coursesPerGeneration: clampCourses(patch.coursesPerGeneration ?? DEFAULT_COURSES),
    params: patch.params ?? DEFAULT_NAVIGATION_PARAMS,
  };
}

export function clampLevel(level: number): number {
  return Number.isFinite(level) ? Math.max(0, Math.min(TOP_LEVEL, Math.round(level))) : 0;
}

export function clampCourses(count: number): number {
  return Number.isFinite(count) ? Math.max(MIN_COURSES, Math.min(MAX_COURSES, Math.round(count))) : DEFAULT_COURSES;
}

/** The Navigation parts of a run config, or a throw for a run of another env. */
export function navigationOf(config: RunConfig): { settings: NavigationSettings; inputs: NavigationInputConfig } {
  if (config.env !== 'navigation' || config.blueprint.env !== 'navigation' || !config.settings) throw new Error('Not a navigation run');
  return { settings: config.settings as unknown as NavigationSettings, inputs: config.blueprint.inputs as unknown as NavigationInputConfig };
}

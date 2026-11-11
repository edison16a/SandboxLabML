import type { EpisodeSetup, SetupInput } from '../../env/episode';
import type { ScriptHost } from '../../training/scriptHost';
import type { NavAgent } from '../agent';
import { builtinNavigationController } from '../builtinReward';
import { generationCourses } from '../curriculum';
import { namedCourse } from '../course/presets';
import type { CourseSpec } from '../course/types';
import { NavigationEnv } from '../env';
import type { NavigationParams } from '../params';
import type { NavigationInputConfig } from '../sensors/inputConfig';
import { contentCourses, contentLevel, type NavigationContent } from './content';
import { CourseCache } from './courseCache';
import { CourseSetEnv } from './courseSet';
import { navigationOf } from './settings';

/**
 * Everything a worker needs to run one Navigation generation, as plain
 * data: the course specs (course 0 is the one on screen), the level, the
 * frozen rules and the brain's sensor config. A Sandbox scene or a ghost
 * replay is the same shape with courses of its own.
 */
export interface NavigationSetup extends EpisodeSetup {
  courses: CourseSpec[];
  level: number;
  params: NavigationParams;
  inputs: NavigationInputConfig;
}

/** The specs a content stands for: its named course, or the generation's fresh courses of its level. */
export function contentSpecs(content: NavigationContent, runSeed: number): CourseSpec[] {
  const named = content.course ? namedCourse(content.course) : undefined;
  return named ? [named] : generationCourses(content.curriculum.level, runSeed, content.generation, contentCourses(content));
}

export function navigationSetupFor({ config, content, scriptSource }: SetupInput<NavigationContent>): NavigationSetup {
  const { settings, inputs } = navigationOf(config);
  return { scriptSource, courses: contentSpecs(content, config.seed), level: contentLevel(content), params: settings.params, inputs };
}

const courses = new CourseCache();

/**
 * One NavigationEnv per course, each with its own controller from the
 * script (or the built in reward), bound into a CourseSetEnv. Script
 * entries can read the level and the course through the controller's extra.
 */
export function createCourseSet(setup: NavigationSetup, host: ScriptHost, seed: number): CourseSetEnv {
  const envs = setup.courses.map((spec) => {
    const course = courses.get(spec, setup.params);
    const controller = host.createController<NavAgent>({ seed, extra: { level: setup.level, course } }) ?? builtinNavigationController;
    return new NavigationEnv({ course, params: setup.params, inputs: setup.inputs, controller, customSensors: host.customSensors, lesion: setup.lesion });
  });
  return new CourseSetEnv(envs, setup.level);
}

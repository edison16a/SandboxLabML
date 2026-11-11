import type { EpisodeLessons } from '../../env/hooks';
import { OUTER_WALL, type CourseSpec } from '../course/types';
import { NAVIGATION_LESSONS_INFO } from './lessonInfo';
import type { CourseSetEnv } from './courseSet';
import type { NavigationRunResult } from './runResult';
import { navigationSettings } from './settings';
import { navigationTestBrain } from './testBrain';

/** The level every lesson's test run and training check starts on: one crate to go round, so a run shows steering at once. */
export const LESSON_LEVEL = 1;

/** What the Studio's lesson preview draws under the runner: the course as built, and its level. */
export interface NavigationPreviewScene {
  spec: CourseSpec;
  level: number;
}

/**
 * Navigation's lesson hooks. Checks run one generated course per
 * generation, starting on level 1 with the automatic curriculum on, so a
 * training check sees the levels climb. The test run is one runner on the
 * first of those courses, with the fixed test brain.
 */
export const navigationLessons: EpisodeLessons<NavigationRunResult> = {
  ...NAVIGATION_LESSONS_INFO,
  measure: (r) => ({ progress: r.progress, finished: r.finished, died: r.died, finishTime: r.finishTime }),
  settings: () => ({ ...navigationSettings({ startLevel: LESSON_LEVEL, coursesPerGeneration: 1, autoLevel: true }) }),
  testBrain: navigationTestBrain,
  preview: {
    // Every Navigation episode is a CourseSetEnv (createEnv builds one), so the cast only names it.
    scene: (env): NavigationPreviewScene => {
      const set = env as CourseSetEnv;
      return { spec: set.courses[0].course.spec, level: set.scene().level };
    },
    bounds: (env) => {
      const { length, width } = (env as CourseSetEnv).courses[0].course.spec;
      return { minX: -length / 2 - OUTER_WALL, minY: -width / 2 - OUTER_WALL, maxX: length / 2 + OUTER_WALL, maxY: width / 2 + OUTER_WALL };
    },
  },
};

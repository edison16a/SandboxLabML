import type { EpisodeLessons } from '../../env/hooks';
import { drivingPreviewBounds, drivingPreviewScene } from '../preview/scene';
import { DRIVING_LESSONS_INFO } from './lessonsInfo';
import type { DrivingRunResult } from './results';
import type { DrivingSettings } from './settings';
import { drivingTestBrain } from './testBrain';
import type { DrivingTrips } from './trips';

/**
 * Lesson checks drive Midtown with traffic lights on, one trip per brain
 * and the level held still, so a check is a few seconds and every lesson
 * sees the same streets. A lesson's generation block may still move the
 * level for training checks (useLevel, autoLevel).
 */
export const LESSON_SETTINGS: DrivingSettings = { city: 'midtown', level: 1, auto: false, trips: 1 };

/** The trip on screen of a lesson episode. Driving builds every episode as DrivingTrips, so the cast only names what createEnv returned. */
const tripOf = (env: unknown) => (env as DrivingTrips).current.opts;

/** Driving's lesson hooks: the light half plus what runs episodes. */
export const DRIVING_LESSONS: EpisodeLessons<DrivingRunResult> = {
  ...DRIVING_LESSONS_INFO,
  measure: (r) => ({
    arrival: r.arrivals / Math.max(1, r.trips),
    completion: r.completion,
    distance: r.distance,
    redLightRuns: r.redLightRuns,
    time: r.time,
  }),
  settings: () => ({ ...LESSON_SETTINGS }),
  testBrain: drivingTestBrain,
  preview: {
    scene: (env) => {
      const { city, route } = tripOf(env);
      return drivingPreviewScene(city, route);
    },
    bounds: (env) => {
      const { city, route } = tripOf(env);
      return drivingPreviewBounds(city, route);
    },
  },
};

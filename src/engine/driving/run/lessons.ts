import { Rng } from '../../core/rng';
import type { EpisodeLessons } from '../../env/hooks';
import { neatConfig } from '../../neat/config';
import type { GenerationContext, ScriptHost } from '../../training/scriptHost';
import { drivingPreviewBounds, drivingPreviewScene } from '../preview/scene';
import { DRIVING_LESSONS_INFO } from './lessonsInfo';
import { requestsOf } from './content';
import type { DrivingRunResult } from './results';
import { clampLevel, type DrivingSettings } from './settings';
import { drivingTestBrain } from './testBrain';
import type { DrivingTrips } from './trips';

/**
 * Lesson checks drive Midtown on empty streets, one trip per brain and
 * the level held still, so a check is a few seconds and every lesson sees
 * the same streets. A lesson's generation block may still move the level
 * for training checks (useLevel, autoLevel).
 */
export const LESSON_SETTINGS: DrivingSettings = { city: 'midtown', level: 1, auto: false, trips: 1 };

/** A generation block's view of the start of a run: nothing has been measured yet. */
const FIRST: GenerationContext = { generation: 0, speciesCount: 0, bestFitness: 0, meanFitness: 0, stagnation: 0 };

/**
 * The lesson settings, moved to the level and city the script's generation
 * block asks for on its first run. A lesson that calls useLevel(level: 2)
 * then has its test drive and preview meet the traffic lights it is about,
 * and its training starts there. Trips stay at one, so checks stay quick.
 */
export function lessonSettings(script?: Pick<ScriptHost, 'runGeneration'>): DrivingSettings {
  if (!script) return { ...LESSON_SETTINGS };
  try {
    const asked = requestsOf(script.runGeneration(FIRST, new Rng(1), neatConfig()).env);
    return { ...LESSON_SETTINGS, level: asked.level !== undefined ? clampLevel(asked.level) : LESSON_SETTINGS.level, city: asked.city ?? LESSON_SETTINGS.city };
  } catch {
    // A block that cannot run without real numbers leaves the lesson where it is.
    return { ...LESSON_SETTINGS };
  }
}

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
  settings: (script) => ({ ...lessonSettings(script) }),
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

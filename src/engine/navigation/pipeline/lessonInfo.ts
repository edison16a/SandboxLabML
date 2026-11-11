import type { EpisodeLessonsInfo } from '../../env/hooks';
import { NAV_LEVELS } from '../course/levels';

const percent = (v: number) => `${Math.round(v * 100)}%`;
const seconds = (v: number) => (v > 0 ? `${v.toFixed(1)} s` : 'no finish');

/**
 * What Navigation lessons can check, for the main thread. A test run is
 * one runner with the fixed test brain on the lesson course; a training
 * check also measures every Navigation metric (progress, level, the
 * finish and death shares). The runtime half is in lessons.ts.
 */
export const NAVIGATION_LESSONS_INFO = {
  testRunName: 'a test run',
  testRunMetrics: ['progress', 'finished', 'died', 'finishTime'],
  brain: 'navigation-starter',
  formats: {
    progress: percent,
    finishShare: percent,
    eliteShare: percent,
    deathShare: percent,
    finishTime: seconds,
    finished: (v: number) => (v >= 1 ? 'the runner finished' : 'the runner did not finish'),
    died: (v: number) => (v >= 1 ? 'the runner died' : 'the runner did not die'),
    level: (v: number) => `level ${v} (${NAV_LEVELS[v]?.name ?? 'unknown'})`,
  },
} satisfies EpisodeLessonsInfo;

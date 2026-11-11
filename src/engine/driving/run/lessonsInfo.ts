import type { EpisodeLessonsInfo } from '../../env/hooks';

const percent = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '-');

/**
 * What Driving lessons can check, as far as the main thread needs to know.
 * A test drive is one trip with the hand set test driver; it measures the
 * share of its trips that arrived (0 or 1 for one trip), the share of the
 * route covered, the meters driven, the red lights run and the seconds it
 * took. A training check measures the generation metrics, which are shares
 * too, so both read as percentages.
 */
export const DRIVING_LESSONS_INFO: EpisodeLessonsInfo = {
  testRunName: 'a test drive',
  testRunMetrics: ['arrived', 'completion', 'distance', 'redLightRuns', 'time'],
  brain: 'driving-standard',
  formats: {
    arrived: percent,
    safe: percent,
    eliteSafe: percent,
    completion: percent,
    crashes: percent,
    pedestrians: percent,
    offRoad: percent,
    redLights: percent,
    distance: (v) => `${Math.round(v)} m`,
    redLightRuns: (v) => `${Math.round(v)} ${Math.round(v) === 1 ? 'red light' : 'red lights'}`,
    time: (v) => `${v.toFixed(1)} s`,
    level: (v) => `level ${Math.round(v)}`,
  },
};

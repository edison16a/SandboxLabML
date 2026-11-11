import type { EpisodeLessonsInfo } from '../../env/hooks';

const percent = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '-');

/** One trip arrived or did not; over several trips, the share that did. */
const arrival = (v: number) => (v === 1 ? 'yes' : v === 0 ? 'no' : percent(v));

/**
 * What Driving lessons can check, as far as the main thread needs to know.
 * A test drive is one trip with the hand set test driver; it measures
 * whether the trip arrived, the red lights run, the share of the route
 * covered, the meters driven and the seconds it took. The Studio's test
 * run shows the first two beside the stop reason, the two a driver most
 * wants to know. The arrival has its own key because a training check's
 * `arrived` is a share of a whole generation, where 0 means 0%, not no.
 */
export const DRIVING_LESSONS_INFO: EpisodeLessonsInfo = {
  testRunName: 'a test drive',
  testRunMetrics: ['arrival', 'redLightRuns', 'completion', 'distance', 'time'],
  brain: 'driving-standard',
  labels: { arrival: 'Arrived', completion: 'Route covered', distance: 'Distance', redLightRuns: 'Red lights', time: 'Time' },
  formats: {
    arrival,
    arrived: percent,
    safe: percent,
    eliteSafe: percent,
    completion: percent,
    crashes: percent,
    pedestrians: percent,
    offRoad: percent,
    redLights: percent,
    distance: (v) => `${Math.round(v)} m`,
    // A bare count: the test run tile already says Red lights.
    redLightRuns: (v) => String(Math.round(v)),
    time: (v) => `${v.toFixed(1)} s`,
    level: (v) => `level ${Math.round(v)}`,
  },
};

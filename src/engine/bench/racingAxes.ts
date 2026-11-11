import type { RadarAxis } from './radar';
import type { RacingRadar } from './types';

/**
 * The Racing radar axes, in drawing order (clockwise from the top). They
 * sit apart from radar.ts so the Racing env module can name them without
 * importing the env registry that radar.ts reads.
 */
export const RACING_RADAR_AXES: ReadonlyArray<RadarAxis<keyof RacingRadar>> = [
  { key: 'speed', label: 'Speed' },
  { key: 'completion', label: 'Completion' },
  { key: 'smoothness', label: 'Smoothness' },
  { key: 'generalization', label: 'Generalization' },
];

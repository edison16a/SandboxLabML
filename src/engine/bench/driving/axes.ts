import type { RadarAxis } from '../radar';

/** The Driving radar's axes, each 0 to 1 (see scoring.ts). A type alias, so it fits BenchRadar's string keyed record. */
export type DrivingRadar = {
  completion: number;
  safety: number;
  efficiency: number;
  generalization: number;
};

/**
 * The Driving radar axes in drawing order, clockwise from the top. They
 * sit in a file of their own so the env's light info can name them
 * without pulling in the exam.
 */
export const DRIVING_RADAR_AXES: ReadonlyArray<RadarAxis<keyof DrivingRadar>> = [
  { key: 'completion', label: 'Completion' },
  { key: 'safety', label: 'Safety' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'generalization', label: 'Generalization' },
];

import type { RadarAxis } from '../radar';

/**
 * Bump when the Navigation exam's rooms, starts or scoring change. It is
 * kept apart from the other envs' versions, so a change to one exam never
 * forces another env's reference file to be rebuilt.
 */
export const NAVIGATION_BENCHMARK_VERSION = 1;

/** The four axes of the Navigation radar, each 0 to 1. See scoring.ts. A type, so it fits the generic BenchRadar record. */
export type NavigationRadar = {
  completion: number;
  safety: number;
  efficiency: number;
  generalization: number;
};

/**
 * Radar axes in drawing order, clockwise from the top. They sit apart from
 * the exam so the light half of the env can name them without loading any
 * course code.
 */
export const NAVIGATION_RADAR_AXES: ReadonlyArray<RadarAxis<keyof NavigationRadar>> = [
  { key: 'completion', label: 'Completion' },
  { key: 'safety', label: 'Safety' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'generalization', label: 'Generalization' },
];

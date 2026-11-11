import type { MetricSpec } from '../../env/metrics';

const percent = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '-');
const seconds = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)} s` : '-');

/** Keys of the Navigation metrics, so the lab's charts and the script slice name them one way. */
export const NAV_METRIC = {
  progress: 'progress',
  finishTime: 'finishTime',
  level: 'level',
  finishShare: 'finishShare',
  eliteShare: 'eliteShare',
  deathShare: 'deathShare',
} as const;

/**
 * What Navigation records per generation. The champion's own progress and
 * finish time sit in the champion table; the level, the share of all runs
 * that finished, the share the best fifth finished (the curriculum's
 * signal) and the share that died chart in the Progress tab.
 */
export const NAVIGATION_METRICS: readonly MetricSpec[] = [
  { key: NAV_METRIC.progress, label: 'Progress', unit: '%', source: 'champion', better: 'higher', format: percent },
  { key: NAV_METRIC.finishTime, label: 'Finish', unit: 's', source: 'champion', better: 'lower', missing: 0, format: seconds },
  { key: NAV_METRIC.level, label: 'Level', unit: '', source: 'generation', better: 'higher', summary: true, format: (v) => (Number.isFinite(v) ? `Level ${v}` : '-') },
  { key: NAV_METRIC.finishShare, label: 'Finished', unit: '%', source: 'generation', better: 'higher', format: percent },
  { key: NAV_METRIC.eliteShare, label: 'Best fifth finished', unit: '%', source: 'generation', better: 'higher', format: percent },
  { key: NAV_METRIC.deathShare, label: 'Died', unit: '%', source: 'generation', better: 'lower', format: percent },
];

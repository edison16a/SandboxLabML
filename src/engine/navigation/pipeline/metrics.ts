import { contentLevel, eliteShareOf, type NavigationContent } from './content';
import { NAV_METRIC } from './metricSpecs';
import type { NavigationRunResult } from './runResult';

/**
 * The generation's numbers over every run of every brain: the level it
 * ran, the share of runs that finished and that died, and the share its
 * best fifth finished, which is what the curriculum climbs on. The gap
 * between the last two is the mutated tail of the population.
 */
export function navigationGenerationMetrics(results: readonly NavigationRunResult[], content: NavigationContent): Record<string, number> {
  let runs = 0;
  let finished = 0;
  let died = 0;
  for (const r of results) {
    runs += r.courses;
    finished += r.finished;
    died += r.died;
  }
  return {
    [NAV_METRIC.level]: contentLevel(content),
    [NAV_METRIC.finishShare]: runs > 0 ? finished / runs : 0,
    [NAV_METRIC.eliteShare]: eliteShareOf(results),
    [NAV_METRIC.deathShare]: runs > 0 ? died / runs : 0,
  };
}

/** The champion's own numbers, stored under `metrics` on its record. */
export function navigationChampionMetrics(r: NavigationRunResult): Record<string, number> {
  return { [NAV_METRIC.progress]: r.progress, [NAV_METRIC.finishTime]: r.finishTime, finished: r.finished, died: r.died, courses: r.courses };
}

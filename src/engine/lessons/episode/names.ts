import type { EpisodeLessonsInfo } from '../../env/episode';
import { requireEpisodeInfo } from '../../env/registry';

/** What a test run measures for an env: the shared numbers, then the env's own. */
export function testRunMetricNames(lessons: EpisodeLessonsInfo): string[] {
  return ['totalReward', 'ticks', 'inputs', ...lessons.testRunMetrics];
}

/** What a training check measures for an env: best fitness, species, then every metric the env records. */
export function trainingMetricNames(env: string): string[] {
  return ['bestFitness', 'species', ...requireEpisodeInfo(env).metrics.map((m) => m.key)];
}

import { episodeInfo } from '../env/registry';
import type { Genome } from '../neat/types';
import type { RunConfig } from '../training/runConfig';
import type { BenchOptions, BenchResult } from './types';

export * from './types';
export { loadReferences, parseReferences, referencesPath } from './references';
export { radarAxesOf, radarValues, type RadarAxis } from './radar';

/**
 * Scores a champion on the benchmark for its run's environment,
 * independent of the training reward. The env module's bench hook drives
 * the champion on content training never sees, such as cities or courses
 * it was never trained on. Returns null when the signal aborts or the env
 * has no benchmark.
 */
export async function runBenchmark(config: RunConfig, model: Genome, opts: BenchOptions = {}): Promise<BenchResult | null> {
  const bench = episodeInfo(config.env)?.bench;
  return bench ? bench.run(config, model, opts) : null;
}

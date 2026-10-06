import type { Genome } from '../neat/types';
import type { RunConfig } from '../training/runConfig';
import { benchmarkRacing, type BenchOptions } from './runner';
import type { BenchResult } from './types';

export * from './types';
export type { BenchOptions } from './runner';
export { loadReferences, parseReferences, referencesPath } from './references';

/**
 * Scores a champion on the benchmark for its run's environment: a fixed
 * exam on roads training never sees, independent of the training reward.
 * Returns null for environments without a benchmark yet (Hide and Seek),
 * or when the signal aborts.
 */
export async function runBenchmark(config: RunConfig, genome: Genome, opts: BenchOptions = {}): Promise<BenchResult | null> {
  return config.env === 'racing' ? benchmarkRacing(config, genome, opts) : null;
}

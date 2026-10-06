import type { Genome } from '../neat/types';
import type { RunConfig } from '../training/runConfig';
import type { BenchReferences, BenchResult } from './types';

export * from './types';

export interface BenchOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Scores a champion on the benchmark for its run's environment. Placeholder
 * until the benchmark engine lands.
 */
export async function runBenchmark(_config: RunConfig, _genome: Genome, _opts: BenchOptions = {}): Promise<BenchResult | null> {
  return null;
}

/** Reference curves shipped under public/references, or null if none exist for this env yet. */
export async function loadReferences(_env: RunConfig['env']): Promise<BenchReferences | null> {
  return null;
}

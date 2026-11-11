import { episodeModule } from '../env/registry';
import type { Genome } from '../neat/types';
import type { RunConfig } from '../training/runConfig';
import { benchmarkHideSeek, type HideSeekBenchOptions } from './hideseek/runner';
import type { HideSeekModel } from './hideseek/types';
import type { BenchResult } from './types';

export * from './types';
export type { HideSeekBenchOptions } from './hideseek/runner';
export type { HideSeekModel } from './hideseek/types';
export { loadReferences, parseReferences, referencesPath } from './references';
export { RADAR_AXES, radarAxesOf, radarValues, type RadarAxis } from './radar';

/** What gets benchmarked: a Racing champion, or a Hide and Seek champion pair. */
export type BenchModel = Genome | HideSeekModel;

const isPair = (m: BenchModel): m is HideSeekModel => 'hider' in m && 'seeker' in m;

/**
 * Scores a model on the benchmark for its run's environment, independent
 * of the training reward. An episode env scores one champion on content
 * training never sees, through its module's bench hook (Racing drives
 * unseen roads). Hide and Seek plays a champion pair against the
 * reference champions. Returns null when the signal aborts, the env has no
 * benchmark, or the model does not match the env.
 */
export async function runBenchmark(config: RunConfig, model: BenchModel, opts: HideSeekBenchOptions = {}): Promise<BenchResult | null> {
  if (config.env === 'hideseek') return isPair(model) ? benchmarkHideSeek(config, model, opts) : null;
  const bench = episodeModule(config.env)?.bench;
  return bench && !isPair(model) ? bench.run(config, model, opts) : null;
}

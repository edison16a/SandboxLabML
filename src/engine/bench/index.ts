import type { Genome } from '../neat/types';
import type { RunConfig } from '../training/runConfig';
import { benchmarkHideSeek, type HideSeekBenchOptions } from './hideseek/runner';
import type { HideSeekModel } from './hideseek/types';
import { benchmarkRacing } from './runner';
import type { BenchResult } from './types';

export * from './types';
export type { BenchOptions } from './runner';
export type { HideSeekBenchOptions } from './hideseek/runner';
export type { HideSeekModel } from './hideseek/types';
export { loadReferences, parseReferences, referencesPath } from './references';
export { RADAR_AXES, radarValues, type RadarAxis } from './radar';

/** What gets benchmarked: a Racing champion, or a Hide and Seek champion pair. */
export type BenchModel = Genome | HideSeekModel;

const isPair = (m: BenchModel): m is HideSeekModel => 'hider' in m && 'seeker' in m;

/**
 * Scores a model on the benchmark for its run's environment, independent
 * of the training reward. Racing drives one champion on roads training
 * never sees. Hide and Seek plays a champion pair against the reference
 * champions. Returns null when the signal aborts or the model does not
 * match the environment (a single genome for Hide and Seek).
 */
export async function runBenchmark(config: RunConfig, model: BenchModel, opts: HideSeekBenchOptions = {}): Promise<BenchResult | null> {
  if (config.env === 'racing') return isPair(model) ? null : benchmarkRacing(config, model, opts);
  return isPair(model) ? benchmarkHideSeek(config, model, opts) : null;
}

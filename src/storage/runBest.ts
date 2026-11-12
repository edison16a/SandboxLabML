import { episodeInfo } from '@/engine/env/registry';
import { metricValue, type MetricSpec } from '@/engine/env/metrics';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunRow } from './db';

/**
 * The run summary after one more generation: how far it got, the best
 * fitness, and the best value of every env metric in the direction the
 * metric prefers, which the Runs page shows.
 */
export function summaryAfter(run: RunRow, r: GenerationRecord): Partial<RunRow> {
  const best = bestAfter(run, r);
  return {
    generation: r.generation + 1,
    bestFitness: Math.max(run.bestFitness, r.champion.fitness),
    benchmark: r.benchmark ?? run.benchmark,
    ...(best && { best }),
  };
}

/** The run's best metric values with one more record folded in, or undefined for an env without metrics here. */
function bestAfter(run: RunRow, r: GenerationRecord): Record<string, number> | undefined {
  const specs = episodeInfo(run.env)?.metrics;
  if (!specs || specs.length === 0) return run.best;
  const best: Record<string, number> = { ...run.best };
  for (const spec of specs) {
    const v = metricValue(r, spec);
    if (!Number.isFinite(v)) continue;
    const old = best[spec.key];
    if (old === undefined || (spec.better === 'higher' ? v > old : v < old)) best[spec.key] = v;
  }
  return best;
}

/** Folds summaryAfter over `records` in order, from the run as created, e.g. after an import or a rewind. */
export function foldSummary(run: RunRow, records: readonly GenerationRecord[]): Partial<RunRow> {
  let row = run;
  for (const r of records) row = { ...row, ...summaryAfter(row, r) };
  const { generation, bestFitness, benchmark, best } = row;
  return { generation, bestFitness, benchmark, ...(best && { best }) };
}

/** The best value of one metric a run reached, or NaN for none yet. */
export function runBest(row: RunRow, spec: MetricSpec): number {
  const value = row.best?.[spec.key];
  return value !== undefined && value !== spec.missing ? value : NaN;
}

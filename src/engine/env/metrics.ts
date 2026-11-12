import type { GenerationRecord } from '../training/records';

/**
 * One number an env records per generation, described well enough for the
 * charts, the champion table and lesson checks to show it without knowing
 * the env. `source` says where it lives: on the champion (its own outcome)
 * or on the record (a stat over the whole population).
 */
export interface MetricSpec {
  key: string;
  label: string;
  /** Short unit for axis labels, such as "m", "s" or "%". Empty for a count. */
  unit: string;
  source: 'champion' | 'generation';
  /** Which way is better, for best so far summaries. */
  better: 'higher' | 'lower';
  /** A value that means "none yet", like a finish time of 0 before any finish. It reads as NaN. */
  missing?: number;
  /** Formats a value for the champion table and chart ticks, e.g. "412 m". NaN means there is none. */
  format(value: number): string;
  /**
   * Also chart a champion metric in the Progress tab. Generation metrics
   * chart unless this is false, since the champion table does not show
   * them; a lab that draws them in its own charts sets it false.
   */
  chart?: boolean;
  /** The one metric a run card on the Runs page shows. Left out everywhere, the first champion metric. */
  summary?: boolean;
}

/** The metric a run card shows: the one marked summary, else the first champion metric. */
export function summaryMetric(specs: readonly MetricSpec[]): MetricSpec | undefined {
  return specs.find((m) => m.summary) ?? specs.find((m) => m.source === 'champion');
}

/** The metrics the Progress tab charts: generation metrics unless they opt out, and champion metrics that ask for it. */
export function chartedMetrics(specs: readonly MetricSpec[]): MetricSpec[] {
  return specs.filter((m) => (m.source === 'generation' ? m.chart !== false : m.chart === true));
}

/**
 * Reads a metric off a record: a champion metric from `champion.metrics`,
 * a generation metric from the record's own `metrics`. A metric the record
 * lacks reads as NaN, so charts leave a gap.
 */
export function metricValue(record: GenerationRecord, spec: MetricSpec): number {
  const value = spec.source === 'generation' ? record.metrics?.[spec.key] : record.champion.metrics?.[spec.key];
  return value === undefined || value === spec.missing ? NaN : value;
}

/** The best value a metric reached over a history, or NaN when it never had one. */
export function bestMetric(records: readonly GenerationRecord[], spec: MetricSpec): number {
  let best = NaN;
  for (const r of records) {
    const v = metricValue(r, spec);
    if (!Number.isFinite(v)) continue;
    if (!Number.isFinite(best) || (spec.better === 'higher' ? v > best : v < best)) best = v;
  }
  return best;
}

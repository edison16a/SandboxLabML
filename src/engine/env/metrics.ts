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
  /** A value that means "none yet", like Racing's lap time of 0 before any lap. It reads as NaN. */
  missing?: number;
  /** Formats a value for the champion table, e.g. "412 m". NaN means there is none. */
  format(value: number): string;
}

/**
 * Reads a metric off a record. Champion metrics live in `champion.metrics`,
 * except Racing's, which predate the map and sit on the champion itself.
 * A metric the record lacks reads as NaN, so charts leave a gap.
 */
export function metricValue(record: GenerationRecord, spec: MetricSpec): number {
  if (spec.source === 'generation') {
    const value = record.metrics?.[spec.key];
    return value === undefined || value === spec.missing ? NaN : value;
  }
  const champion = record.champion as unknown as Record<string, unknown>;
  const value = record.champion.metrics?.[spec.key] ?? champion[spec.key];
  return typeof value === 'number' && value !== spec.missing ? value : NaN;
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

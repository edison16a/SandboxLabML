import type uPlot from 'uplot';
import type { ReferenceCurve, ReferenceTier } from '@/engine/bench/types';
import { runColumn } from './benchmarkGaps';

/**
 * One hue per reference script, told apart from This run's blue and from
 * each other on the dark panel, also with red or green color blindness.
 * The run's own reference is solid with its band; the others are thin and
 * dashed, so identity never rests on hue alone.
 */
export const TIER_COLORS: Record<ReferenceTier, string> = { beginner: '#3fc1a5', intermediate: '#d6b4fc', advanced: '#ff9f43' };
export const RUN_COLOR = '#4c9aff';

/** The references in drawing order: the others first, the run's own last, so its band and line sit on top. */
export function drawOrder(tiers: readonly ReferenceCurve[], match: ReferenceTier | null): ReferenceCurve[] {
  return [...tiers.filter((t) => t.tier !== match), ...tiers.filter((t) => t.tier === match)];
}

/**
 * The chart's series and bands. Only the reference that matches the run
 * gets its middle half shaded. Three overlapping bands read as one smear
 * once the curves converge, as Driving's do from generation 100 on.
 */
export function benchmarkSeries(order: readonly ReferenceCurve[], match: ReferenceTier | null): { series: uPlot.Series[]; bands: uPlot.Band[] } {
  const series: uPlot.Series[] = [{}];
  const bands: uPlot.Band[] = [];
  for (const t of order) {
    const color = TIER_COLORS[t.tier];
    if (t.tier === match) {
      const base = series.length;
      series.push({ label: `${t.tier} p75`, stroke: 'transparent', points: { show: false } });
      series.push({ label: `${t.tier} p25`, stroke: 'transparent', points: { show: false } });
      series.push({ label: t.tier, stroke: color, width: 1.5, points: { show: false } });
      bands.push({ series: [base, base + 1], fill: `${color}2e` });
    } else {
      series.push({ label: t.tier, stroke: color, width: 1, dash: [4, 3], points: { show: false } });
    }
  }
  series.push({ label: 'This run', stroke: RUN_COLOR, width: 2, points: { show: true, size: 5, fill: RUN_COLOR } });
  return { series, bands };
}

/** The data columns in the same order as benchmarkSeries, on one generation axis shared by the run and every reference. */
export function benchmarkData(order: readonly ReferenceCurve[], match: ReferenceTier | null, points: ReadonlyArray<{ generation: number; benchmark?: number }>): uPlot.AlignedData {
  const gens = new Set<number>();
  order.forEach((t) => t.curve.forEach((p) => gens.add(p.generation)));
  points.forEach((r) => gens.add(r.generation));
  const xs = [...gens].sort((a, b) => a - b);
  const cols: Array<Array<number | null | undefined>> = [];
  for (const t of order) {
    const at = new Map(t.curve.map((p) => [p.generation, p]));
    // Undefined where a tier has no checkpoint, so its line joins across the run's own generations.
    if (t.tier === match) cols.push(xs.map((g) => at.get(g)?.p75), xs.map((g) => at.get(g)?.p25));
    cols.push(xs.map((g) => at.get(g)?.median));
  }
  cols.push(runColumn(xs, points));
  return [xs.map((g) => g + 1), ...cols] as uPlot.AlignedData;
}
